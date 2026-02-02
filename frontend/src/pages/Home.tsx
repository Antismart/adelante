import { Link } from "react-router-dom";
import { ArrowRight, Upload, DollarSign, CheckCircle, Globe, User, Shield, Zap } from "lucide-react";
import { Button } from "../components/common/Button";

const steps = [
  {
    icon: Upload,
    title: "Upload Invoice",
    description:
      "Create an invoice NFT with your payment details and upload supporting documents.",
  },
  {
    icon: DollarSign,
    title: "Get Funded",
    description:
      "List your invoice at a discount and receive instant payment from investors.",
  },
  {
    icon: CheckCircle,
    title: "Settle",
    description:
      "When your debtor pays, the smart contract releases funds to the investor.",
  },
];

export function Home() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              Don't wait.{" "}
              <span className="text-primary-200">Adelante.</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-primary-100 max-w-2xl mx-auto">
              Turn your unpaid invoices into instant cash. The decentralized
              marketplace for invoice factoring on NEAR Protocol.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/dashboard">
                <Button
                  size="lg"
                  className="bg-white text-primary-700 hover:bg-primary-50"
                >
                  I'm a Business
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to="/marketplace">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                >
                  I'm an Investor
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Wave decoration */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg
            viewBox="0 0 1440 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full"
          >
            <path
              d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
              fill="#fafafa"
            />
          </svg>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-neutral-900">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-neutral-600">
              Get cash for your invoices in three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="relative bg-white rounded-xl p-8 shadow-sm border border-neutral-200"
              >
                <div className="absolute -top-4 left-8 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold">
                  {index + 1}
                </div>
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                  <step.icon className="w-6 h-6 text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-neutral-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NEAR Native Features */}
      <section className="py-20 bg-gradient-to-b from-neutral-50 to-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-sm font-medium mb-4">
              Powered by NEAR Protocol
            </div>
            <h2 className="text-3xl font-bold text-neutral-900">
              Built for the Future
            </h2>
            <p className="mt-4 text-lg text-neutral-600 max-w-2xl mx-auto">
              Adelante leverages NEAR's unique features to provide a seamless,
              secure, and truly global invoice financing experience.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Human-Readable Accounts */}
            <div className="bg-white rounded-xl p-6 border border-neutral-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-neutral-900 mb-2">
                Human-Readable Names
              </h3>
              <p className="text-sm text-neutral-600">
                Use memorable account names like <code className="text-primary-600">grace-textiles.near</code> instead of complex addresses.
              </p>
            </div>

            {/* Chain Signatures */}
            <div className="bg-white rounded-xl p-6 border border-neutral-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Globe className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-neutral-900 mb-2">
                Cross-Chain Ready
              </h3>
              <p className="text-sm text-neutral-600">
                Receive payments on Ethereum, Polygon, and more through NEAR's Chain Signatures.
              </p>
            </div>

            {/* Fast & Cheap */}
            <div className="bg-white rounded-xl p-6 border border-neutral-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-neutral-900 mb-2">
                Instant & Affordable
              </h3>
              <p className="text-sm text-neutral-600">
                1-second finality with transaction fees under $0.01. No waiting, no high gas fees.
              </p>
            </div>

            {/* Escrow Security */}
            <div className="bg-white rounded-xl p-6 border border-neutral-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="font-semibold text-neutral-900 mb-2">
                Smart Escrow
              </h3>
              <p className="text-sm text-neutral-600">
                Funds secured in smart contracts until invoice settlement. Disputes resolved fairly on-chain.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-neutral-900 text-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-primary-400">
                $3.1T
              </div>
              <div className="mt-2 text-neutral-400">
                Global Unpaid Invoices
              </div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-primary-400">
                45 days
              </div>
              <div className="mt-2 text-neutral-400">Average Payment Term</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-primary-400">
                &lt;1 min
              </div>
              <div className="mt-2 text-neutral-400">Time to Get Funded</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-primary-400">
                5-15%
              </div>
              <div className="mt-2 text-neutral-400">Typical Discount</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-8 sm:p-12 text-center text-white">
            <h2 className="text-2xl sm:text-3xl font-bold">
              Ready to unlock your cash flow?
            </h2>
            <p className="mt-4 text-primary-100 max-w-xl mx-auto">
              Join the future of invoice financing. No banks. No paperwork. Just
              open rails on NEAR Protocol.
            </p>
            <div className="mt-8">
              <Link to="/dashboard">
                <Button
                  size="lg"
                  className="bg-white text-primary-700 hover:bg-primary-50"
                >
                  Get Started
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
