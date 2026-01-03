import { FormEvent, useRef, useState } from "react";
import "./TerminalInput.css";

interface TerminalInputProps {
  onSubmit: (value: string) => void;
}

export function TerminalInput({ onSubmit }: TerminalInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(value.trim());
    setValue("");
    inputRef.current?.focus();
  };

  return (
    <form className="terminal-input" onSubmit={handleSubmit}>
      <label className="terminal-label" htmlFor="command-input">
        cmd
      </label>
      <div className="terminal-field">
        <span aria-hidden="true">:</span>
        <input
          id="command-input"
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="hash | redact | sanitize | meta | enc | pw | vault"
          autoComplete="off"
          spellCheck={false}
          aria-label="Command line"
        />
      </div>
      <button type="submit" className="terminal-submit" aria-label="Execute command">
        return
      </button>
    </form>
  );
}
