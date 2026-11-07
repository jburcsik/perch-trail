import type { PerchUpdate, Locale } from '@/content/perch-updates'

export function PerchUpdateCard({ post, locale }: { post: PerchUpdate; locale: Locale }) {
  return (
    <div
      id={post.slug}
      className="bg-white rounded-3xl p-8 shadow-lg border border-amber-100 scroll-mt-20"
    >
      <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold">
        {new Date(post.date + 'T00:00:00').toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
      <h2 className="text-3xl font-bold text-gray-900 mt-2">{post.title[locale]}</h2>
      {post.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.photo}
          alt={post.title[locale]}
          className="mt-5 w-full rounded-2xl object-cover max-h-96"
        />
      )}
      <p className="mt-5 text-gray-600 leading-relaxed text-lg whitespace-pre-wrap">{post.body[locale]}</p>
      {post.link && (
        <a
          href={post.link.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 mt-6 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-full px-5 py-2.5 transition-colors"
        >
          {post.link.label[locale]}
        </a>
      )}
    </div>
  )
}
