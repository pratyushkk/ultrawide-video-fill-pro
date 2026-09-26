import React, { useId, useMemo } from 'react';

export type SliderVariant = 'blue' | 'violet' | 'hdr' | 'amber';

export interface SliderProps {
  label: string;
  icon?: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  displayValue?: string;
  minLabel: string;
  maxLabel: string;
  variant: SliderVariant;
  disabled?: boolean;
  onChange: (value: number) => void;
  onReset?: () => void;
  showReset?: boolean;
  resetTitle?: string;
  'aria-label'?: string;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  icon,
  value,
  min,
  max,
  step = 1,
  displayValue,
  minLabel,
  maxLabel,
  variant,
  disabled = false,
  onChange,
  onReset,
  showReset = false,
  resetTitle,
  'aria-label': ariaLabel,
}) => {
  const inputId = useId();

  // Calculate percentage of track filled (0% to 100%)
  const percentage = useMemo(() => {
    const range = max - min;
    if (range <= 0) return 0;
    const clamped = Math.max(min, Math.min(max, value));
    return ((clamped - min) / range) * 100;
  }, [value, min, max]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = parseFloat(e.target.value);
    onChange(Number.isFinite(nextVal) ? nextVal : 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    let nextVal = value;
    const stepSize = step || 1;
    const bigStep = stepSize * 5;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        nextVal = Math.min(max, value + (e.shiftKey ? bigStep : stepSize));
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        nextVal = Math.max(min, value - (e.shiftKey ? bigStep : stepSize));
        break;
      case 'PageUp':
        e.preventDefault();
        nextVal = Math.min(max, value + bigStep);
        break;
      case 'PageDown':
        e.preventDefault();
        nextVal = Math.max(min, value - bigStep);
        break;
      case 'Home':
        e.preventDefault();
        nextVal = min;
        break;
      case 'End':
        e.preventDefault();
        nextVal = max;
        break;
      default:
        return;
    }
    onChange(nextVal);
  };

  const formattedDisplay = displayValue !== undefined ? displayValue : `${value}%`;

  return (
    <div className={`control-block slider-variant-${variant} ${disabled ? 'disabled' : ''}`}>
      <div className="control-header">
        <div className="control-title-wrap">
          {icon && <span className="control-icon">{icon}</span>}
          <label htmlFor={inputId} className="control-title">{label}</label>
          {showReset && onReset && (
            <button
              type="button"
              className="slider-reset-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onReset();
              }}
              title={resetTitle || 'Reset'}
              aria-label={resetTitle || 'Reset'}
            >
              Reset
            </button>
          )}
        </div>
        <span className="control-value-badge" aria-live="polite">
          {formattedDisplay}
        </span>
      </div>

      <div className="slider-track-wrap">
        <input
          id={inputId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label={ariaLabel || label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={formattedDisplay}
          className={`premium-slider slider-${variant}`}
          style={
            {
              '--slider-fill-pct': `${percentage}%`,
            } as React.CSSProperties
          }
        />
      </div>

      <div className="slider-sublabels" aria-hidden="true">
        <span className="sublabel-left">{minLabel}</span>
        <span className="sublabel-right">{maxLabel}</span>
      </div>
    </div>
  );
};
