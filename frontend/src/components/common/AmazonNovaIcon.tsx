import React, { useId } from "react";

interface AmazonNovaIconProps {
  size?: number;
  className?: string;
}

const AmazonNovaIcon: React.FC<AmazonNovaIconProps> = ({
  size = 16,
  className,
}) => {
  const gradientId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="50%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <polygon
        fill={`url(#${gradientId})`}
        points="32 4 37 18 52 12 42 24 58 32 42 38 52 52 37 46 32 60 27 46 12 52 22 38 6 32 22 24 12 12 27 18"
      />
    </svg>
  );
};

export default AmazonNovaIcon;
