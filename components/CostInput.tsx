import React, { useEffect, useState } from 'react';

interface CostInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  unit?: string;
  step?: number;
  helpText?: string;
  min?: number;
  max?: number;
}

export const CostInput: React.FC<CostInputProps> = ({
  label,
  value,
  onChange,
  unit,
  step = 1,
  helpText,
  min = 0,
  max,
}) => {
  const [rawValue, setRawValue] = useState(value.toString());

  useEffect(() => {
    setRawValue(value.toString());
  }, [value]);

  const commitValue = () => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      setRawValue(value.toString());
      return;
    }

    let next = parsed;
    if (typeof min === 'number') next = Math.max(min, next);
    if (typeof max === 'number') next = Math.min(max, next);

    if (next !== value) onChange(next);
    setRawValue(next.toString());
  };

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {unit && <span className="text-xs text-gray-500 font-mono">{unit}</span>}
      </div>
      <input
        type="number"
        value={rawValue}
        onChange={(e) => setRawValue(e.target.value)}
        onBlur={commitValue}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
        step={step}
        min={min}
        max={max}
        className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
      />
      {helpText && <p className="mt-1 text-xs text-gray-500">{helpText}</p>}
    </div>
  );
};
