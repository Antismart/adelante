import { Github, ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-neutral-900 text-neutral-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          {/* Brand */}
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <div className="w-6 h-6 bg-primary-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="text-white font-semibold">Adelante</span>
            <span className="text-sm">— Don't wait.</span>
          </div>

          {/* Links */}
          <div className="flex items-center space-x-6">
            <a
              href="https://near.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 hover:text-white transition-colors"
            >
              <span className="text-sm">Built on NEAR</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://github.com/adelante"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 hover:text-white transition-colors"
            >
              <Github className="w-4 h-4" />
              <span className="text-sm">GitHub</span>
            </a>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-neutral-800 text-center text-sm">
          <p>
            NEAR Protocol Hackathon — "Open Society: From Finance to the Real
            World"
          </p>
        </div>
      </div>
    </footer>
  );
}
