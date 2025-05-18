import React, { useState } from 'react';

interface UsernameInputProps {
  onJoin: (username: string) => void;
  disabled: boolean;
}

const UsernameInput: React.FC<UsernameInputProps> = ({ onJoin, disabled }) => {
  const [username, setUsername] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      onJoin(username.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="username-form">
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Enter your username"
        disabled={disabled}
      />
      <button type="submit" disabled={disabled || !username.trim()}>
        Join Game
      </button>
    </form>
  );
};

export default UsernameInput;