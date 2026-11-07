import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-amber-50 flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center">
        <p className="text-7xl mb-4" aria-hidden="true">&#129722;</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
          Looks like this nest is empty.
        </h1>
        <p className="text-gray-700 mb-8">
          We can&apos;t find the page you were looking for. It might have flown off, or maybe the link was a little crooked. Try one of these instead:
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Home
          </Link>
          <Link
            href="/map"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-900 px-5 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Trail map
          </Link>
          <Link
            href="/get-involved"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-900 px-5 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Get involved
          </Link>
        </div>
      </div>
    </main>
  )
}
