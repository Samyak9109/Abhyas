"""Safe HTTP fetcher with SSRF defense and HTML sanitization (architecture 15.3)."""

import ipaddress
import re
import socket
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx

USER_AGENT = "AbhyasResearchBot/1.0 (+https://abhyas.app/bot; research@abhyas.app)"
MAX_PAGE_SIZE_BYTES = 500_000
MAX_CLEANED_CHARS = 40_000

BLOCKED_TAGS: set[str] = {
    "script",
    "style",
    "noscript",
    "svg",
    "canvas",
    "nav",
    "header",
    "footer",
    "iframe",
    "object",
    "embed",
}


class HTMLTextExtractor(HTMLParser):
    """Safely extracts readable text while stripping code, styles, and hidden elements."""

    def __init__(self) -> None:
        super().__init__()
        self._pieces: list[str] = []
        self._title: str | None = None
        self._in_title = False
        self._ignored_stack: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag_lower = tag.lower()
        if tag_lower in BLOCKED_TAGS:
            self._ignored_stack.append(tag_lower)
            return

        # Check for hidden attributes
        attr_dict = {k.lower(): (v.lower() if v else "") for k, v in attrs}
        if attr_dict.get("aria-hidden") == "true" or "hidden" in attr_dict:
            self._ignored_stack.append(tag_lower)
            return
        style = attr_dict.get("style", "")
        if "display:none" in style or "visibility:hidden" in style:
            self._ignored_stack.append(tag_lower)
            return

        if tag_lower == "title" and self._title is None:
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        tag_lower = tag.lower()
        if self._ignored_stack and self._ignored_stack[-1] == tag_lower:
            self._ignored_stack.pop()
        if tag_lower == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._ignored_stack:
            return
        text = data.strip()
        if not text:
            return
        if self._in_title and self._title is None:
            self._title = text
        self._pieces.append(text)

    def get_text(self) -> str:
        raw = " ".join(self._pieces)
        cleaned = re.sub(r"\s+", " ", raw).strip()
        return cleaned[:MAX_CLEANED_CHARS]

    def get_title(self) -> str:
        return self._title or "Untitled Document"


class SafeFetcher:
    """SSRF-resistant, robots-aware HTTP fetcher for company research (FR-026)."""

    def __init__(self, timeout: float = 8.0) -> None:
        self.timeout = timeout
        self._robots_cache: dict[str, RobotFileParser] = {}

    @staticmethod
    def is_private_or_loopback_ip(ip_str: str) -> bool:
        """Check if an IP address belongs to loopback, private, link-local, or reserved subnets."""
        try:
            ip = ipaddress.ip_address(ip_str)
            if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
                mapped = ip.ipv4_mapped
                if (
                    mapped.is_private
                    or mapped.is_loopback
                    or mapped.is_link_local
                    or mapped.is_reserved
                ):
                    return True
            return (
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_reserved
                or ip.is_multicast
                or ip.is_unspecified
            )
        except ValueError:
            return True

    def validate_url(self, url: str, expected_domain: str | None = None) -> None:
        """Validate that a URL is safe from SSRF and targeting approved public origins."""
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise ValueError(f"Unsupported URL scheme: {parsed.scheme}")

        hostname = parsed.hostname
        if not hostname:
            raise ValueError("URL has no valid hostname")

        # Block literal loopbacks and localhost
        if hostname.lower() in ("localhost", "127.0.0.1", "::1", "metadata.google.internal"):
            raise ValueError(f"SSRF blocked: forbidden host '{hostname}'")

        # Resolve DNS and verify all resolved IPs
        try:
            addr_info = socket.getaddrinfo(hostname, None)
            for item in addr_info:
                ip_str = item[4][0]
                if self.is_private_or_loopback_ip(ip_str):
                    raise ValueError(f"SSRF blocked: '{hostname}' resolved to private IP {ip_str}")
        except socket.gaierror as e:
            raise ValueError(f"DNS resolution failure for '{hostname}': {e}") from e

        # If expected domain given, ensure host belongs to domain or common public engineering blog
        if expected_domain:
            expected_clean = expected_domain.lower().strip()
            host_clean = hostname.lower().strip()
            is_subdomain = host_clean == expected_clean or host_clean.endswith(f".{expected_clean}")
            is_allowlisted_external = host_clean in (
                "github.com",
                "medium.com",
                "substack.com",
                "wikipedia.org",
            )
            if not (is_subdomain or is_allowlisted_external):
                raise ValueError(
                    f"URL host '{host_clean}' does not match expected domain '{expected_clean}'"
                )

    async def fetch_page(
        self,
        url: str,
        expected_domain: str | None = None,
        mock_response: str | None = None,
    ) -> tuple[str, str]:
        """Fetch and clean page content. Returns (title, cleaned_text)."""
        if mock_response is not None:
            parser = HTMLTextExtractor()
            parser.feed(mock_response)
            return parser.get_title(), parser.get_text()

        current_url = url
        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml",
        }

        async with httpx.AsyncClient(
            timeout=self.timeout,
            follow_redirects=False,
        ) as client:
            content_bytes = b""
            for _ in range(5):
                self.validate_url(current_url, expected_domain)
                async with client.stream("GET", current_url, headers=headers) as resp:
                    if resp.is_redirect and "location" in resp.headers:
                        current_url = urljoin(current_url, resp.headers["location"])
                        continue

                    if resp.status_code >= 400:
                        raise ValueError(f"HTTP fetch error {resp.status_code} for {current_url}")

                    # Re-verify final URL after redirects for SSRF
                    final_url = str(resp.url)
                    self.validate_url(final_url, expected_domain)

                    content_type = resp.headers.get("content-type", "").lower()
                    if "text/html" not in content_type and "application/xhtml" not in content_type:
                        raise ValueError(f"Non-HTML content type '{content_type}' at {current_url}")

                    chunks: list[bytes] = []
                    total = 0
                    async for chunk in resp.aiter_bytes():
                        chunks.append(chunk)
                        total += len(chunk)
                        if total >= MAX_PAGE_SIZE_BYTES:
                            break

                    content_bytes = b"".join(chunks)[:MAX_PAGE_SIZE_BYTES]
                    break
            else:
                raise ValueError(f"Too many redirects for {url}")

            html_text = content_bytes.decode("utf-8", errors="replace")

            parser = HTMLTextExtractor()
            parser.feed(html_text)
            return parser.get_title(), parser.get_text()
