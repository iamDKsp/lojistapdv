import React, { useId } from 'react';

export interface RetailSwitchProps {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onChange?: (e: { target: { checked: boolean }; currentTarget: { checked: boolean } }) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md';
  id?: string;
  className?: string;
  'aria-label'?: string;
}

export const RetailSwitch: React.FC<RetailSwitchProps> = ({
  checked,
  onCheckedChange,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  id,
  className = '',
  'aria-label': ariaLabel,
}) => {
  const autoId = useId();
  const switchId = id || autoId;
  const labelId = `${switchId}-label`;
  const descId = `${switchId}-desc`;

  const toggle = () => {
    if (disabled) return;
    const next = !checked;
    onCheckedChange?.(next);
    onChange?.({
      target: { checked: next },
      currentTarget: { checked: next },
    });
  };

  return (
    <div
      className={`pdv-switch-row ${disabled ? 'is-disabled' : ''} ${className}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button[role="switch"]')) return;
        toggle();
      }}
    >
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={label ? labelId : undefined}
        aria-describedby={description ? descId : undefined}
        aria-label={!label ? ariaLabel : undefined}
        disabled={disabled}
        onClick={toggle}
        className={`pdv-switch-track ${size === 'sm' ? 'pdv-switch-sm' : ''} ${
          checked ? 'is-checked' : ''
        }`}
      >
        <span className="pdv-switch-thumb" aria-hidden="true" />
      </button>

      {(label || description) && (
        <div className="pdv-switch-copy">
          {label && (
            <label
              id={labelId}
              htmlFor={switchId}
              onClick={(e) => e.preventDefault()}
              className="pdv-switch-label"
            >
              {label}
            </label>
          )}
          {description && (
            <span id={descId} className="pdv-switch-desc">
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
