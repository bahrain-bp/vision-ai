import {
  Loader,
  Eye,
  EyeOff,
  LucideIcon,
} from "lucide-react";
import React, { useState, ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick: () => void;
  loading?: boolean;
  icon?: LucideIcon;
  className?: string;
}

interface InputFieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: LucideIcon;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  loading = false,
  icon: Icon,
  className = "",
}) => (
  <button
    onClick={onClick}
    disabled={loading}
    className={`button ${
      loading ? "button-loading" : "button-normal"
    } ${className}`}
  >
    {loading ? (
      <Loader className="spinner" />
    ) : (
      <>
        {Icon && <Icon className="icon" />}
        <span>{children}</span>
      </>
    )}
  </button>
);

export const InputField: React.FC<InputFieldProps> = ({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  icon: Icon,
}) => {
  const isPassword = type === "password";
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const inputType = isPassword && showPassword ? "text" : type;

  return (
    <div className="input-container">
      <label htmlFor={id} className="input-label">
        {label}
      </label>
      <div className="input-wrapper">
        {Icon && (
          <div className="input-icon">
            <Icon className="icon" />
          </div>
        )}
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          className="input-field"
        />
        {isPassword && (
          <button
            type="button"
            className="password-toggle"
            onClick={() => {
              setShowPassword(!showPassword);
            }}
          >
            {showPassword ? (
              <EyeOff className="icon" />
            ) : (
              <Eye className="icon" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};
