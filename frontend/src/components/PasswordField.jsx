import { useState } from 'react'
import { MIN_PASSWORD_LENGTH, meetsPasswordMinimum } from '../passwordValidation'

const recommendationChecks = [
  { label: 'Lowercase letter', test: password => /\p{Ll}/u.test(password) },
  { label: 'Uppercase letter', test: password => /\p{Lu}/u.test(password) },
  { label: 'Number', test: password => /\p{N}/u.test(password) },
  { label: 'Special character', test: password => /[^\p{L}\p{N}\s]/u.test(password) },
]

function StatusIcon({ met, invalid = false }) {
  if (met) {
    return (
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="currentColor" fillOpacity="0.18" />
        <path d="m4.75 8.1 2.05 2.05 4.45-4.45" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (invalid) {
    return (
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
        <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
        <path d="m5.75 5.75 4.5 4.5m0-4.5-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
      <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function StatusItem({ label, met, invalid = false }) {
  const tone = met
    ? 'text-teal-muted'
    : invalid
      ? 'text-red-400'
      : 'text-white/40'

  return (
    <li className={`flex items-center gap-2 ${tone}`}>
      <StatusIcon met={met} invalid={invalid} />
      <span className="sr-only">{met ? 'Met: ' : 'Not met: '}</span>
      <span>{label}</span>
    </li>
  )
}

function PasswordRequirements({ id, password, minimumInvalid }) {
  const minimumMet = meetsPasswordMinimum(password)

  return (
    <div id={id} className="mt-3 rounded-xl border border-white/5 bg-jet/45 p-4 text-xs">
      <p className="mb-2 font-medium uppercase tracking-widest text-white/55">Required</p>
      <ul>
        <StatusItem
          label={`${MIN_PASSWORD_LENGTH} or more characters`}
          met={minimumMet}
          invalid={minimumInvalid}
        />
      </ul>

      <div className="mb-2 mt-4 flex items-center justify-between gap-3">
        <p className="font-medium uppercase tracking-widest text-white/55">Recommended</p>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/35">
          Optional
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {recommendationChecks.map(check => (
          <StatusItem key={check.label} label={check.label} met={check.test(password)} />
        ))}
      </ul>
    </div>
  )
}

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder = '••••••••',
  required = true,
  minLength,
  describedBy,
  invalid = false,
  onFieldBlur,
  onInvalid,
}) {
  const [visible, setVisible] = useState(false)

  function handleBlur(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      onFieldBlur?.(event)
    }
  }

  return (
    <div className="relative" onBlur={handleBlur}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        value={value}
        onChange={onChange}
        onInvalid={onInvalid}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={`w-full rounded-xl border bg-jet px-4 py-3 pr-16 text-sm text-white outline-none transition-colors placeholder:text-white/20 ${
          invalid
            ? 'border-red-400/60 focus:border-red-400'
            : 'border-transparent focus:border-teal'
        }`}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setVisible(current => !current)}
        aria-controls={id}
        aria-label={`${visible ? 'Hide' : 'Show'} password`}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center px-4 text-xs font-medium text-teal-muted transition-colors hover:text-white focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-teal"
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

export function PasswordMatchStatus({ id, password, confirmation }) {
  if (!confirmation) return null

  const matches = password === confirmation

  return (
    <p
      id={id}
      role="status"
      aria-live="polite"
      className={`mt-2 flex items-center gap-2 text-xs ${matches ? 'text-teal-muted' : 'text-white/40'}`}
    >
      <StatusIcon met={matches} />
      {matches ? 'Passwords match' : 'Passwords do not match yet'}
    </p>
  )
}

export default function NewPasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = 'new-password',
  placeholder = 'At least 8 characters',
}) {
  const [touched, setTouched] = useState(false)
  const requirementsId = `${id}-requirements`
  const minimumInvalid = touched && !meetsPasswordMinimum(value)

  function handleChange(event) {
    const nextPassword = event.currentTarget.value
    event.currentTarget.setCustomValidity(
      nextPassword && !meetsPasswordMinimum(nextPassword)
        ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
        : '',
    )
    onChange(event)
  }

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs uppercase tracking-widest text-teal-muted">
        {label}
      </label>
      <PasswordInput
        id={id}
        value={value}
        onChange={handleChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        minLength={MIN_PASSWORD_LENGTH}
        describedBy={requirementsId}
        invalid={minimumInvalid}
        onFieldBlur={() => setTouched(true)}
        onInvalid={() => setTouched(true)}
      />
      <PasswordRequirements
        id={requirementsId}
        password={value}
        minimumInvalid={minimumInvalid}
      />
    </div>
  )
}
