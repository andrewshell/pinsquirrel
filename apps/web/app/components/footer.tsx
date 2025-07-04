import { Link } from 'react-router';

export function Footer() {
  return (
    <footer className="border-t bg-gray-50 mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center gap-6 text-sm text-gray-600">
          <Link to="/terms" className="hover:text-gray-900">
            Terms of Service
          </Link>
          <Link to="/privacy" className="hover:text-gray-900">
            Privacy Policy
          </Link>
        </div>
        <div className="text-center text-xs text-gray-500 mt-4">
          © {new Date().getFullYear()} Andrew Shell LLC. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
