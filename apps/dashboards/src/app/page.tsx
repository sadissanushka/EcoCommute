import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12">
      <div className="max-w-4xl w-full text-center space-y-8">
        <div>
          <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-3">
            Module 5 Analytics & Privacy Engine
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
            Corporate ESG & Urban Mobility Dashboards
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
            Interactive, high-speed dashboards providing corporate commute ESG metrics and differentially private urban traffic heatmaps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {/* Admin Portal Card */}
          <Link
            href="/admin"
            className="group bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 transition duration-200 hover:shadow-xl hover:shadow-emerald-500/5 flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold mb-4 group-hover:scale-105 transition-transform">
                ESG
              </div>
              <h2 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                Company Admin Dashboard
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Monitor corporate carpool & shuttle participation, Scope 3 commute carbon avoided, department-level modal splits, and fuel reimbursement balances.
              </p>
            </div>
            <div className="mt-6 flex items-center text-sm font-semibold text-emerald-400">
              Launch Admin Dashboard &rarr;
            </div>
          </Link>

          {/* Government Portal Card */}
          <Link
            href="/gov"
            className="group bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-6 transition duration-200 hover:shadow-xl hover:shadow-blue-500/5 flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold mb-4 group-hover:scale-105 transition-transform">
                DP
              </div>
              <h2 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                Government Mobility Planning
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                City-wide urban traffic flow heatmaps protected by strict ε-Differential Privacy (Laplace noise) and k-anonymity suppression with real-time budget tracking.
              </p>
            </div>
            <div className="mt-6 flex items-center text-sm font-semibold text-blue-400">
              Launch Government Heatmap &rarr;
            </div>
          </Link>
        </div>

        <div className="text-xs text-slate-500 pt-8 border-t border-slate-900">
          Corporate Employee Shuttle & Shared Commute Platform &bull; Stack Kings
        </div>
      </div>
    </main>
  );
}
