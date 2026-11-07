import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'PrivacyPage' })
  return {
    title: t('metaTitle'),
    description: 'How we handle the small amount of information we collect.',
  }
}

export default async function PrivacyPage() {
  const t = await getTranslations('PrivacyPage')
  const bold = { b: (chunks: React.ReactNode) => <strong>{chunks}</strong> }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 text-gray-800 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2 [&_p]:leading-relaxed [&_p]:mb-4 [&_ul]:list-disc [&_ul]:ps-6 [&_ul]:mb-4 [&_li]:mb-1 [&_a]:text-amber-700 [&_a:hover]:underline">
      <h1>{t('title')}</h1>

      <p>{t('intro')}</p>

      <h2>{t('whatWeAskHeading')}</h2>
      <ul>
        <li>{t.rich('nameItem', bold)}</li>
        <li>{t.rich('emailItem', bold)}</li>
        <li>{t.rich('communityQuestionItem', bold)}</li>
      </ul>
      <p>{t('afterSetup')}</p>

      <h2>{t('emailDeletionHeading')}</h2>
      <p>{t('emailReason')}</p>
      <p>{t('emailDeletionDetail')}</p>

      <h2>{t('whatWeDontHeading')}</h2>
      <ul>
        <li>{t('dontSell')}</li>
        <li>{t('dontShareMarketing')}</li>
        <li>{t('dontUseOtherwise')}</li>
        <li>{t('dontShowHostName')}</li>
      </ul>

      <h2>{t('serviceProvidersHeading')}</h2>
      <p>{t('serviceProvidersText')}</p>

      <h2>{t('questionsHeading')}</h2>
      <p>
        {t.rich('questionsText', {
          getInvolvedLink: (chunks) => <Link href="/get-involved">{chunks}</Link>,
        })}
      </p>

      <p className="text-sm text-gray-500">{t('lastUpdated')}</p>
    </main>
  )
}
