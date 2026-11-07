import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { SITE_NAME } from '@/config/site'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'TermsPage' })
  return {
    title: t('metaTitle'),
    description: `A short, plain-language summary of what you can expect from ${SITE_NAME} and what we ask of you.`,
  }
}

export default async function TermsPage() {
  const t = await getTranslations('TermsPage')

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 text-gray-800 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2 [&_p]:leading-relaxed [&_p]:mb-4 [&_ul]:list-disc [&_ul]:ps-6 [&_ul]:mb-4 [&_li]:mb-1 [&_a]:text-amber-700 [&_a:hover]:underline">
      <h1>{t('title')}</h1>

      <p>{t('intro')}</p>

      <h2>{t('requestingHeading')}</h2>
      <p>{t('requestingText')}</p>

      <h2>{t('whatGoesPublicHeading')}</h2>
      <p>
        {t.rich('whatGoesPublicText', {
          privacyLink: (chunks) => <Link href="/privacy">{chunks}</Link>,
        })}
      </p>

      <h2>{t('editingHeading')}</h2>
      <p>{t('editingText')}</p>

      <h2>{t('removingHeading')}</h2>
      <p>
        {t.rich('removingText', {
          getInvolvedLink: (chunks) => <Link href="/get-involved">{chunks}</Link>,
        })}
      </p>

      <h2>{t('changesHeading')}</h2>
      <p>{t('changesText1')}</p>
      <p>{t('changesText2')}</p>

      <h2>{t('noWarrantyHeading')}</h2>
      <p>{t('noWarrantyText')}</p>

      <p className="text-sm text-gray-500">{t('lastUpdated')}</p>
    </main>
  )
}
