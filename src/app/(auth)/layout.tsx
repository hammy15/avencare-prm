export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800">
        {/* Animated background shapes */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-emerald-400/20 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-teal-300/10 rounded-full blur-2xl animate-pulse delay-500" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-2xl font-bold text-white">Avencare PRM</span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              Admission Packet
              <br />
              <span className="text-teal-200">Verification System</span>
            </h1>
            <p className="text-lg text-teal-100/80 max-w-md">
              Verify credentials and compliance for hospice and palliative care admissions.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4 mt-8">
            {[
              { icon: '✓', text: 'Real-time license verification' },
              { icon: '✓', text: 'Multi-state compliance tracking' },
              { icon: '✓', text: 'Automated expiration alerts' },
              { icon: '✓', text: 'Comprehensive audit reports' },
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-teal-100">
                <span className="w-6 h-6 bg-teal-400/30 rounded-full flex items-center justify-center text-sm">
                  {feature.icon}
                </span>
                <span>{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom branding */}
        <div className="absolute bottom-8 left-12 xl:left-20 text-teal-200/60 text-sm">
          © 2026 Avencare. All rights reserved.
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 p-8">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
