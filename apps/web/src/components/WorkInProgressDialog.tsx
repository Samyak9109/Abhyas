// TEMPORARY pre-backend-deploy gate (P6 routes): remove this component once the
// research service is deployed and schedule/review ship for real.
import { Button } from "./Button";
import { Dialog } from "./Dialog";

interface WorkInProgressDialogProps {
  featureName: string;
  onClose: () => void;
}

export function WorkInProgressDialog({ featureName, onClose }: WorkInProgressDialogProps) {
  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="&#123; Work in progress &#125;"
      actions={
        <Button variant="primary" onClick={onClose}>
          Back to Home
        </Button>
      }
    >
      <p className="abh-prose">
        {featureName} is part of an upcoming release and isn&apos;t available in this preview yet
        while the backend service is being deployed. Practice, history, skills and settings all
        work now — everything still runs on your device.
      </p>
    </Dialog>
  );
}
