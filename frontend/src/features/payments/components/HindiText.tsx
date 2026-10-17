import { useState } from "react";

export function HindiText({ english, hindi, className }: { english: string; hindi: string; className: string }) {
  const [showHindi, setShowHindi] = useState(false);
  return (
    <div className={className}>
      <div className="mb-1 flex justify-end">
        <button type="button" className="text-xs font-semibold underline" onClick={() => setShowHindi((current) => !current)}>
          {showHindi ? "English" : "हिंदी"}
        </button>
      </div>
      <p>{showHindi ? hindi : english}</p>
    </div>
  );
}
