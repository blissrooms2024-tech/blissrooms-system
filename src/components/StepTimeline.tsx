export interface TimelineStep {
  label: string;
  sublabel?: string;
  state: "done" | "active" | "pending" | "rejected";
}

/** Vertical progress stepper (bill review, maintenance requests, ...). */
export default function StepTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <Dot state={step.state} />
              {!isLast && (
                <div className={`w-0.5 flex-1 min-h-[22px] ${step.state === "done" ? "bg-brand" : "bg-gray-200"}`} />
              )}
            </div>
            <div className={isLast ? "pb-0.5" : "pb-4"}>
              <div
                className={`text-sm font-semibold ${
                  step.state === "pending"
                    ? "text-gray-400"
                    : step.state === "rejected"
                      ? "text-red-600"
                      : "text-gray-800"
                }`}
              >
                {step.label}
              </div>
              {step.sublabel && <div className="text-xs text-gray-400">{step.sublabel}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Dot({ state }: { state: TimelineStep["state"] }) {
  if (state === "done") {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs text-white">
        ✓
      </div>
    );
  }
  if (state === "rejected") {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-xs text-white">
        ✕
      </div>
    );
  }
  if (state === "active") {
    return (
      <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
        <span className="absolute h-6 w-6 animate-ping rounded-full bg-brand/40" />
        <span className="relative h-3 w-3 rounded-full bg-brand" />
      </div>
    );
  }
  return <div className="h-6 w-6 shrink-0 rounded-full border-2 border-gray-300 bg-white" />;
}
