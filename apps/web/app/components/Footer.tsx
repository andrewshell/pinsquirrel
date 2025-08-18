import { Link } from 'react-router'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="w-full bg-card border-t-4 border-foreground mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col space-y-2 md:flex-row md:justify-between md:items-center md:space-y-0 text-sm text-foreground font-bold uppercase text-center md:text-left">
          {/* Copyright */}
          <div className="flex flex-col space-y-2 md:flex-row md:items-center md:space-y-0 md:space-x-4">
            <div className=" px-2 py-1">© {currentYear} Andrew Shell LLC.</div>
            <div className=" px-2 py-1">All rights reserved.</div>
          </div>

          {/* Legal Links */}
          <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-4">
            <Link
              to="/privacy"
              className="hover:text-primary transition-colors border-2 border-transparent hover:border-foreground px-2 py-1"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="hover:text-primary transition-colors border-2 border-transparent hover:border-foreground px-2 py-1"
            >
              Terms of Use
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
