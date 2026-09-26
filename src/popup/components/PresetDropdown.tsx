import React, { useState, useRef, useEffect } from 'react';
import { PresetIcon, ChevronIcon, CheckIcon } from './Icons';

export interface Preset {
  id: string;
  name: string;
  sharpness: number;
  hdrBoost: number;
  description?: string;
}

export const PRESET_OPTIONS: Preset[] = [
  { id: 'original', name: 'Original', sharpness: 0, hdrBoost: 0, description: 'No enhancement' },
  { id: 'cinematic', name: 'Cinematic', sharpness: 35, hdrBoost: 30, description: 'Balanced contrast & detail' },
  { id: 'crisp', name: 'Crisp', sharpness: 60, hdrBoost: 10, description: 'High sharpness, subtle dynamic range' },
  { id: 'hdr', name: 'HDR', sharpness: 25, hdrBoost: 65, description: 'Vivid color & dynamic range' },
];

export function getActivePresetName(sharpness: number, hdrBoost: number): string {
  if (sharpness === 0 && hdrBoost === 0) return 'Original';
  if (sharpness === 35 && hdrBoost === 30) return 'Cinematic';
  if (sharpness === 60 && hdrBoost === 10) return 'Crisp';
  if (sharpness === 25 && hdrBoost === 65) return 'HDR';
  return 'Custom';
}

interface PresetDropdownProps {
  currentSharpness: number;
  currentHdrBoost: number;
  onSelectPreset: (preset: Preset) => void;
  disabled?: boolean;
}

export const PresetDropdown: React.FC<PresetDropdownProps> = ({
  currentSharpness,
  currentHdrBoost,
  onSelectPreset,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const activeName = getActivePresetName(currentSharpness, currentHdrBoost);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
    setFocusedIndex(-1);
  };

  const handleSelect = (preset: Preset) => {
    onSelectPreset(preset);
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % PRESET_OPTIONS.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + PRESET_OPTIONS.length) % PRESET_OPTIONS.length);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < PRESET_OPTIONS.length) {
          handleSelect(PRESET_OPTIONS[focusedIndex]);
        }
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`preset-dropdown-container ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={buttonRef}
        type="button"
        className="preset-trigger-row"
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <div className="preset-trigger-left">
          <span className="control-icon preset-icon">
            <PresetIcon />
          </span>
          <span className="preset-label">Presets</span>
        </div>
        <div className="preset-trigger-right">
          <span className={`preset-active-value ${activeName === 'Custom' ? 'custom' : ''}`}>
            {activeName}
          </span>
          <ChevronIcon expanded={isOpen} />
        </div>
      </button>

      {isOpen && (
        <ul
          className="preset-menu"
          role="listbox"
          aria-label="Video Enhancement Presets"
        >
          {PRESET_OPTIONS.map((preset, index) => {
            const isSelected = activeName === preset.name;
            const isFocused = focusedIndex === index;

            return (
              <li
                key={preset.id}
                role="option"
                aria-selected={isSelected}
                className={`preset-menu-item ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''}`}
                onClick={() => handleSelect(preset)}
                onMouseEnter={() => setFocusedIndex(index)}
              >
                <div className="preset-item-info">
                  <span className="preset-item-name">{preset.name}</span>
                  <span className="preset-item-meta">
                    {preset.sharpness === 0 && preset.hdrBoost === 0
                      ? 'Off'
                      : `S:${preset.sharpness}% • HDR:${preset.hdrBoost}%`}
                  </span>
                </div>
                {isSelected && (
                  <span className="preset-item-check">
                    <CheckIcon />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
