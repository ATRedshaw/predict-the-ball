/**
 * Site-wide footer. Consistent across all pages.
 */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="max-w-7xl mx-auto mt-6 flex items-center justify-between text-teal text-xs">
      <span className="pr-4">© {year} PredictTheBall</span>
      <div className="flex gap-4">
        <a href="/privacy" className="hover:text-teal-muted transition-colors">Privacy</a>
        <a href="/terms"   className="hover:text-teal-muted transition-colors">Terms</a>
        <a href="/contact" className="hover:text-teal-muted transition-colors">Contact</a>
      </div>
    </footer>
  );
}
