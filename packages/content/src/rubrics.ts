// FR-012, FR-017, ADR-006: Canonical rubric definitions and accessors for all experience levels.
import { RubricLevelSchema, type ExperienceLevel, type RubricLevel } from "@abhyas/core";

export const INTERN_FRESHER_RUBRIC: RubricLevel = RubricLevelSchema.parse({
  level: "intern_fresher",
  description:
    "Foundational level for interns, new graduates, and developers with under 1 year of professional experience. Evaluates core concepts, learning aptitude, and structured thinking rather than enterprise production experience.",
  axes: {
    depth:
      "Foundational understanding of core principles, basic CS fundamentals, standard libraries, and common algorithms.",
    ambiguity:
      "Low ambiguity expected; questions provide clear inputs, outputs, and constraints with immediate clarification available.",
    expectedScope:
      "Single function, module, or standard pattern scope; academic coursework or small project implementation.",
    followUpPressure:
      "Gentle, supportive probing to explore reasoning and verify that the candidate understands their chosen approach.",
    behavioralExpectations:
      "Demonstrates curiosity, humility, receptiveness to feedback, active learning, and structured communication of school or personal projects.",
  },
  criteria: {
    relevance: {
      name: "Relevance & Directness",
      description:
        "Answers the fundamental question asked without dodging or reciting unrelated memorized definitions.",
      anchors: {
        "1": "Misses the question prompt completely or recites unrelated textbook definitions without addressing what was asked.",
        "3": "Directly addresses the primary question with relevant concepts, though may miss minor edge cases or nuance.",
        "5": "Directly and concisely answers the question, explains why the approach was chosen, and immediately identifies basic constraints.",
      },
    },
    structure: {
      name: "Structural Framing",
      description:
        "Organizes thoughts logically, using STAR for behavioral questions and step-by-step reasoning for technical problems.",
      anchors: {
        "1": "Disorganized stream of consciousness with no clear beginning, reasoning chain, or conclusion.",
        "3": "Follows a recognizable logical sequence (problem, attempt, resolution) with understandable progression.",
        "5": "Exemplary structured narrative: states assumptions upfront, steps through logic methodically, and summarizes the conclusion clearly.",
      },
    },
    depth: {
      name: "Technical & Conceptual Depth",
      description:
        "Demonstrates genuine understanding of underlying mechanics rather than shallow surface-level keywords.",
      anchors: {
        "1": "Uses buzzwords without understanding; unable to explain basic mechanics or why a simple algorithm works.",
        "3": "Understands fundamental mechanics, Big-O complexity for basic operations, and how standard components interact.",
        "5": "Solid grasp of foundational internals, discusses trade-offs between two basic approaches, and correctly reasons about edge cases.",
      },
    },
    clarity: {
      name: "Clarity & Articulation",
      description:
        "Explains ideas clearly with accessible vocabulary, low rambling, and audible conviction.",
      anchors: {
        "1": "Highly fragmented speech, frequent false starts, excessive verbal fillers, or extreme hesitation that obscures meaning.",
        "3": "Communicates ideas clearly with understandable vocabulary and pacing, occasionally pausing to gather thoughts.",
        "5": "Crisp, concise, and engaging delivery; articulates complex thoughts simply and checks for understanding naturally.",
      },
    },
    levelFit: {
      name: "Level Alignment",
      description:
        "Calibrated against intern/new-grad expectations of curiosity, coachability, and solid fundamental knowledge.",
      anchors: {
        "1": "Struggles with basic first-year computer science fundamentals or shows resistance to hints and guidance.",
        "3": "Comfortably meets junior/intern expectations: solves standard basic problems and responds constructively to hints.",
        "5": "Shows maturity well beyond typical new-grad level: anticipates edge cases, writes clean mental logic, and shows high proactive curiosity.",
      },
    },
  },
});

export const JUNIOR_RUBRIC: RubricLevel = RubricLevelSchema.parse({
  level: "junior",
  description:
    "Junior engineer level (1 to 3 years professional experience). Focuses on practical day-to-day software development, clean implementation, testing, debugging, and understanding basic design patterns within existing codebases.",
  axes: {
    depth:
      "Practical familiarity with language idioms, testing frameworks, standard APIs, database queries, and basic error handling.",
    ambiguity:
      "Moderate ambiguity; questions may require identifying typical missing requirements or common operational failure modes.",
    expectedScope:
      "Feature-level implementation, component architecture, API endpoints, bug triage, and small subsystem contributions.",
    followUpPressure:
      "Moderate follow-ups on testing edge cases, boundary conditions, failure scenarios, and code maintainability.",
    behavioralExpectations:
      "Demonstrates team collaboration, responsiveness to code reviews, proactive communication when blocked, and reliable execution.",
  },
  criteria: {
    relevance: {
      name: "Relevance & Directness",
      description:
        "Directly tackles practical engineering challenges and frames answers around practical production considerations.",
      anchors: {
        "1": "Drifts into theoretical tangents without providing a practical software implementation or answer to the problem.",
        "3": "Provides a sensible, working practical solution that addresses the user story or technical requirement directly.",
        "5": "Delivers an exact, pragmatic solution; immediately addresses requirements and highlights relevant production edge cases.",
      },
    },
    structure: {
      name: "Structural Framing",
      description:
        "Presents structured workflows: requirement understanding -> design approach -> edge case handling -> verification.",
      anchors: {
        "1": "Jumps straight to implementation details without clarifying requirements, testing strategy, or context.",
        "3": "Presents a clear structure: clarifies the goal, describes the implementation, and discusses how to test it.",
        "5": "Very disciplined delivery: frames context efficiently, highlights trade-offs systematically, and closes with verification results.",
      },
    },
    depth: {
      name: "Technical & Conceptual Depth",
      description:
        "Demonstrates practical software development expertise including error handling, testing, and concurrency basics.",
      anchors: {
        "1": "Ignores errors, null checks, race conditions, or performance implications in typical software environments.",
        "3": "Considers validation, basic error recovery, unit testing, and common runtime behaviors accurately.",
        "5": "Shows strong practical depth: discusses idempotent retries, database transaction boundaries, or profiling tools thoughtfully.",
      },
    },
    clarity: {
      name: "Clarity & Articulation",
      description:
        "Communicates engineering concepts with accurate terminology and clear, professional delivery.",
      anchors: {
        "1": "Imprecise terminology, rambling explanations, or difficulty articulating why a specific library or method was chosen.",
        "3": "Uses standard engineering terminology accurately and explains logic in a straightforward, listener-friendly manner.",
        "5": "Exceptionally clear and professional communication; conveys complex bugs and resolutions with brevity and confidence.",
      },
    },
    levelFit: {
      name: "Level Alignment",
      description:
        "Calibrated against 1-3 year engineering expectations for feature delivery and professional execution.",
      anchors: {
        "1": "Lacks basic awareness of professional software practices such as automated testing, git workflows, or code reviews.",
        "3": "Solid junior engineer: delivers dependable code, understands basic design patterns, and collaborates productively with teammates.",
        "5": "Exhibits near-mid-level maturity: demonstrates self-directed debugging, proactive test coverage, and clean modular designs.",
      },
    },
  },
});

export const MID_RUBRIC: RubricLevel = RubricLevelSchema.parse({
  level: "mid",
  description:
    "Mid-level engineer (3 to 5 years professional experience). Evaluates autonomous delivery, trade-off reasoning, subsystem architecture, observability, fault tolerance, and cross-functional collaboration without requiring constant supervision.",
  axes: {
    depth:
      "Thorough understanding of distributed patterns, database indexing, caching strategies, asynchronous processing, and system failure modes.",
    ambiguity:
      "Substantial ambiguity; candidate is expected to ask clarifying questions, establish boundary constraints, and justify non-functional trade-offs.",
    expectedScope:
      "Multi-component or service-level architecture, data pipeline, performance bottleneck resolution, and feature lifecycle from design to release.",
    followUpPressure:
      "Rigorous follow-ups examining edge cases under load, data inconsistency, migration strategies, and degradation policies.",
    behavioralExpectations:
      "Demonstrates strong ownership, ability to resolve moderate conflict with peers, mentoring junior developers, and delivering on commitments.",
  },
  criteria: {
    relevance: {
      name: "Relevance & Directness",
      description:
        "Frames solutions around operational realities, SLA constraints, and tangible business/engineering requirements.",
      anchors: {
        "1": "Gives purely academic definitions rather than evaluating real engineering trade-offs suitable for production systems.",
        "3": "Focuses directly on engineering trade-offs, service requirements, and concrete implementation choices.",
        "5": "Pinpoints the core architectural tension immediately; addresses latency, throughput, consistency, and operational complexity directly.",
      },
    },
    structure: {
      name: "Structural Framing",
      description:
        "Applies a structured architectural and behavioral methodology (e.g., Requirements -> Data Flow -> Trade-offs -> Bottlenecks).",
      anchors: {
        "1": "Ad-hoc design that changes direction repeatedly without a clear guiding architecture or structured STAR story.",
        "3": "Well-organized presentation: outlines requirements, proposes a primary architecture, and discusses operational trade-offs.",
        "5": "Masterful presentation: systematically addresses functional and non-functional requirements, evaluates alternative designs, and synthesizes choices.",
      },
    },
    depth: {
      name: "Technical & Conceptual Depth",
      description:
        "Deep understanding of operational failure modes, concurrency, database indices, and system metrics.",
      anchors: {
        "1": "Superficial knowledge; cannot explain how indexes work under the hood, how caches invalidate, or how connection pools behave.",
        "3": "Solid technical depth: explains cache invalidation, database isolation levels, message queues, and backpressure mechanisms.",
        "5": "Impressive technical depth: discusses p99 latency spikes, lock contention, write-amplification, and zero-downtime schema migrations.",
      },
    },
    clarity: {
      name: "Clarity & Articulation",
      description:
        "Balances technical depth with clear, succinct summaries that keep the interviewer engaged.",
      anchors: {
        "1": "Verbose, rambling answers that get lost in low-level trivia while missing high-level architectural clarity.",
        "3": "Speaks with clarity, confidence, and appropriate pacing; transitions cleanly between architectural concepts.",
        "5": "Highly articulate and engaging; uses vivid mental models, summarizes key trade-offs compactly, and invites active dialogue.",
      },
    },
    levelFit: {
      name: "Level Alignment",
      description:
        "Calibrated against autonomous 3-5 year engineer expectations for trade-off evaluation and system resilience.",
      anchors: {
        "1": "Requires continuous hand-holding on standard design trade-offs or shows passive, reactive ownership.",
        "3": "Quintessential mid-level engineer: works autonomously, makes sound technical decisions, and understands production ramifications.",
        "5": "Exhibits senior-level instincts: proactively identifies hidden systemic risks, cost implications, and operational overhead.",
      },
    },
  },
});

export const SENIOR_RUBRIC: RubricLevel = RubricLevelSchema.parse({
  level: "senior",
  description:
    "Senior engineer level (5 to 8 years professional experience). Evaluates distributed system architecture at scale, fault tolerance, operational excellence, risk mitigation, developer velocity, technical mentorship, and driving consensus across teams.",
  axes: {
    depth:
      "Mastery of distributed consensus, CAP/PACELC trade-offs, network partitions, multi-region replication, observability, and cost-performance boundaries.",
    ambiguity:
      "High ambiguity; prompts often present ill-defined business problems where the candidate must define scope, constraints, and success metrics.",
    expectedScope:
      "Multi-system or cross-service domain, core platform components, long-term tech debt strategy, and company-wide standards.",
    followUpPressure:
      "Deep stress-testing on extreme traffic spikes, cascade failures, data corruption recovery, blast radius containment, and cost efficiency.",
    behavioralExpectations:
      "Exemplary technical leadership, navigating cross-team politics constructively, fostering psychological safety, and driving blameless post-mortems.",
  },
  criteria: {
    relevance: {
      name: "Relevance & Directness",
      description:
        "Grounds high-level architecture in organizational constraints, team topology, ROI, and reliability goals.",
      anchors: {
        "1": "Over-engineers needlessly, introducing trendy technologies without considering maintenance burden, team skills, or cost.",
        "3": "Focuses on pragmatic architecture; balances scalability needs against delivery timelines, maintenance cost, and complexity.",
        "5": "Strategically precise: frames architecture around business outcomes, risk boundaries, organizational bandwidth, and evolutionary design.",
      },
    },
    structure: {
      name: "Structural Framing",
      description:
        "Flawlessly frames complex distributed architectures from executive summary to deep technical failure analysis.",
      anchors: {
        "1": "Scattered coverage that fails to define boundaries, data models, or SLAs before jumping into specific tooling.",
        "3": "Methodical framework: defines SLAs/SLOs, maps component topologies, evaluates data flow, and establishes failure domains.",
        "5": "Executive-grade delivery: structures complex multi-system solutions into clear milestones, risk registers, and architectural principles.",
      },
    },
    depth: {
      name: "Technical & Conceptual Depth",
      description:
        "Deep distributed systems expertise: replication topologies, consensus protocols, split-brain handling, and backpressure.",
      anchors: {
        "1": "Superficial hand-waving on critical topics like data consistency, idempotency keys, partition tolerance, or graceful degradation.",
        "3": "Deep technical grasp: details Raft/Paxos implications, event-driven architectures, circuit breakers, and database sharding.",
        "5": "Authoritative mastery: analyzes tail-latency amplification, distributed transaction trade-offs (2PC vs Saga), and disaster recovery runbooks.",
      },
    },
    clarity: {
      name: "Clarity & Articulation",
      description:
        "Communicates with high emotional intelligence, commanding executive presence, and crisp precision.",
      anchors: {
        "1": "Combative or excessively dogmatic delivery; defensive when questioned or unable to articulate alternative points of view.",
        "3": "Clear, persuasive, and open-minded communication; welcomes pushback and defends decisions with objective data.",
        "5": "Inspiring, crystal-clear delivery; translates complex technical nuances into accessible analogies while maintaining rigorous precision.",
      },
    },
    levelFit: {
      name: "Level Alignment",
      description:
        "Calibrated against senior engineer expectations of technical leadership, blast-radius containment, and strategic foresight.",
      anchors: {
        "1": "Operates as a mid-level task executor who lacks systemic foresight, risk awareness, or cross-team leadership.",
        "3": "Strong senior engineer: leads architectural design, anticipates operational hurdles, and elevates team members.",
        "5": "Operates at staff caliber: connects low-level system details to multi-quarter business strategy and organizational capability.",
      },
    },
  },
});

export const STAFF_PLUS_RUBRIC: RubricLevel = RubricLevelSchema.parse({
  level: "staff_plus",
  description:
    "Staff+ engineer level (Principal, Staff, Distinguished, 8+ years experience). Evaluates org-wide technical strategy, multi-year architecture roadmaps, build vs. buy evaluations, organizational Conway's law alignment, and executive influence.",
  axes: {
    depth:
      "Holistic domain mastery: distributed systems economics, global platform governance, compliance, enterprise resilience, and organizational dynamics.",
    ambiguity:
      "Extreme ambiguity; problems involve vague, conflicting company priorities, emerging technologies, or multi-year structural transformations.",
    expectedScope:
      "Organization-wide or multi-team platforms, cross-company technical strategy, foundational architecture bets, and engineering culture.",
    followUpPressure:
      "Strategic pushback on long-term maintainability, talent constraints, opportunity cost, vendor lock-in, and organizational headwinds.",
    behavioralExpectations:
      "Unifying technical vision, navigating organizational politics gracefully, sponsoring underrepresented talent, and driving cultural change.",
  },
  criteria: {
    relevance: {
      name: "Relevance & Directness",
      description:
        "Aligns engineering strategy with overarching business viability, financial runway, and organizational leverage.",
      anchors: {
        "1": "Advocates for ivory-tower architecture disconnected from business reality, budget constraints, or team capabilities.",
        "3": "Directly links architectural strategy to business ROI, engineering leverage, and organizational sustainability.",
        "5": "Masterful strategic synthesis: re-frames the problem around competitive advantages, capital efficiency, and sustainable velocity.",
      },
    },
    structure: {
      name: "Structural Framing",
      description:
        "Employs macro-level architectural frameworks: business capabilities -> domain boundaries -> platform primitives -> migration vectors.",
      anchors: {
        "1": "Lacks cohesive strategic vision; jumps between disparate micro-level tactics without establishing guiding principles.",
        "3": "Comprehensive strategic framework: clearly sets guiding principles, domain boundaries, phased migration phases, and governance.",
        "5": "Visionary structure: articulates clear decision matrices, risk mitigation milestones, and cultural change roadmaps effortlessly.",
      },
    },
    depth: {
      name: "Technical & Conceptual Depth",
      description:
        "Evaluates foundational tech choices across decades: data sovereignty, zero-trust security, multi-cloud economics, and legacy modernization.",
      anchors: {
        "1": "Out-of-touch with modern technical realities or relies on dogmatic patterns that no longer match industry state of the art.",
        "3": "Deep and broad mastery: understands cross-platform primitives, cost modeling, data mesh concepts, and resilience patterns.",
        "5": "Profound insight: evaluates ecosystem trends, hardware/cloud cost curves, kernel/compiler evolutions, and org-level leverage points.",
      },
    },
    clarity: {
      name: "Clarity & Articulation",
      description:
        "Communicates seamlessly with VP/C-suite executives, cross-functional leads, and junior engineers alike.",
      anchors: {
        "1": "Overly condescending, impenetrable jargon-heavy monologue, or inability to tailor communication to different audiences.",
        "3": "Speaks with empathy, clarity, and authority; builds consensus through compelling arguments and rigorous active listening.",
        "5": "Inspirational communicator: simplifies profound complexities into irresistible narratives that drive swift organizational alignment.",
      },
    },
    levelFit: {
      name: "Level Alignment",
      description:
        "Calibrated against Staff/Principal engineer expectations of company-wide leverage, culture building, and multiplying others.",
      anchors: {
        "1": "Functions merely as a senior individual contributor solving isolated tickets without company-wide leverage or impact.",
        "3": "Authentic Staff engineer: multiplies whole engineering teams, sets architectural standards, and leads high-risk strategic initiatives.",
        "5": "Distinguished caliber: reshapes company-wide engineering culture, foresees multi-year industry disruptions, and builds durable platforms.",
      },
    },
  },
});

export const CANONICAL_RUBRICS: Record<ExperienceLevel, RubricLevel> = {
  intern_fresher: INTERN_FRESHER_RUBRIC,
  junior: JUNIOR_RUBRIC,
  mid: MID_RUBRIC,
  senior: SENIOR_RUBRIC,
  staff_plus: STAFF_PLUS_RUBRIC,
};

/**
 * Returns the canonical rubric for the specified experience level.
 */
export function getRubricForLevel(level: ExperienceLevel): RubricLevel {
  const rubric = CANONICAL_RUBRICS[level];
  if (!rubric) {
    return CANONICAL_RUBRICS.mid;
  }
  return rubric;
}
