import { Link } from 'react-router'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-card border-t-4 border-foreground mt-auto neobrutalism-shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* Copyright */}
          <div className="text-sm text-foreground font-bold uppercase">
            © {currentYear} Andrew Shell LLC. All rights reserved.
          </div>

          {/* Legal Links */}
          <nav className="flex items-center space-x-6">
            <Link
              to="/privacy"
              className="text-sm text-foreground font-bold uppercase hover:text-primary transition-colors border-2 border-transparent hover:border-foreground px-3 py-1"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="text-sm text-foreground font-bold uppercase hover:text-primary transition-colors border-2 border-transparent hover:border-foreground px-3 py-1"
            >
              Terms of Use
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
