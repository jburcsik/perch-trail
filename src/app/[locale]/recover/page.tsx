import { getTranslations } from 'next-intl/server'
import { RecoverForm } from '@/components/RecoverForm'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'RecoverPage' })
  return {
    title: t('metaTitle'),
  }
}

export default async function RecoverPage() {
  const t = await getTranslations('RecoverPage')

  return (
    <main className="max-w-xl mx-auto px-4 py-12">
      <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
        {t('title')}
      </h1>
      <p className="text-gray-700 mb-2">
        {t('intro1')}
      </p>
      <p className="text-gray-700 mb-6">
        {t('intro2')}
      </p>

      <RecoverForm />

      <p className="mt-8 text-xs text-gray-500">
        {t('footerNote')}
      </p>
    </main>
  )
}
