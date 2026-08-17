import { Link } from 'react-router-dom'

/**
 * Site-wide footer. Consistent across all pages.
 */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="max-w-7xl mx-auto mt-6 flex flex-col items-center gap-3 text-center text-teal text-xs">
      <span>
        <Link to="/" className="hover:text-teal-muted transition-colors">
          © {year} PredictTheBall
        </Link>{" "}·{" "}
        <a href="https://atredshaw.com" target="_blank" rel="noreferrer" className="hover:text-teal-muted transition-colors">
          Alex Redshaw
        </a>
      </span>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        <a href="/how-it-works" className="hover:text-teal-muted transition-colors">How it works</a>
        <a href="/privacy" className="hover:text-teal-muted transition-colors">Privacy</a>
        <a href="/terms"   className="hover:text-teal-muted transition-colors">Terms</a>
        <a href="mailto:predict.the.ball.app@gmail.com" className="hover:text-teal-muted transition-colors">Contact</a>
        <a href="https://github.com/ATRedshaw/predict-the-ball" target="_blank" rel="noreferrer" className="hover:text-teal-muted transition-colors">GitHub</a>
      </div>
    </footer>
  );
}
