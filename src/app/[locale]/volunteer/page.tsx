'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { ContactForm } from '@/components/ContactForm'

export default function VolunteerPage() {
  const t = useTranslations('VolunteerPage')
  const tContact = useTranslations('ContactForm')

  const roles = [
    {
      icon: '\u{1F4CC}',
      title: t('posteringTitle'),
      description: t('posteringDescription'),
    },
    {
      icon: '\u{1F3A8}',
      title: t('graphicDesignTitle'),
      description: t('graphicDesignDescription'),
    },
    {
      icon: '\u{1F58C}\u{FE0F}',
      title: t('paintingHelperTitle'),
      description: t('paintingHelperDescription'),
    },
    {
      icon: '\u{1F6AA}',
      title: t('communityAwarenessTitle'),
      description: t('communityAwarenessDescription'),
    },
    {
      icon: '\u{1F528}',
      title: t('installerTitle'),
      description: t('installerDescription'),
    },
    {
      icon: '\u{1F4AC}',
      title: t('moderatorTitle'),
      description: t('moderatorDescription'),
    },
    {
      icon: '\u{1F4F8}',
      title: t('socialMediaTitle'),
      description: t('socialMediaDescription'),
    },
    {
      icon: '\u{270D}\u{FE0F}',
      title: t('writerTitle'),
      description: t('writerDescription'),
    },
    {
      icon: '\u{1F4BB}',
      title: t('developerTitle'),
      description: t('developerDescription'),
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-amber-600 to-orange-600 text-white py-16 shadow-xl">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-4">{t('title')}</h1>
          <p className="text-xl opacity-90 max-w-xl mx-auto">
            {t('subtitle')}
          </p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-16 max-w-4xl">

        {/* Intro */}
        <div className="text-center mb-16">
          <p className="text-xl text-gray-700 max-w-2xl mx-auto leading-relaxed">
            {t('intro')}
          </p>
          <p className="text-gray-500 mt-4">{t('lightWork')}</p>
        </div>

        {/* Roles grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {roles.map(role => (
            <div
              key={role.title}
              className="bg-white rounded-3xl p-6 shadow-md border border-amber-100 hover:shadow-lg transition-shadow duration-200"
            >
              <div className="text-4xl mb-4">{role.icon}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{role.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{role.description}</p>
            </div>
          ))}
        </div>

        {/* Birdhouse CTA */}
        <div className="bg-amber-600 text-white rounded-3xl p-10 text-center shadow-xl mb-12">
          <div className="text-5xl mb-4">&#127968;</div>
          <h2 className="text-3xl font-bold mb-3">{t('getBirdhouseTitle')}</h2>
          <p className="text-lg opacity-90 max-w-lg mx-auto mb-8">
            {t('getBirdhouseDescription')}
          </p>
          <Link href="/get-involved">
            <Button
              size="lg"
              className="bg-white text-amber-700 hover:bg-amber-50 px-10 rounded-full font-bold text-lg shadow-md"
            >
              {t('getFreeBirdhouse')}
            </Button>
          </Link>
        </div>

        {/* Contact form */}
        <div className="bg-white rounded-3xl p-8 shadow-lg border border-amber-100">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('readyToHelp')}</h2>
          <p className="text-gray-500 mb-8">{t('readyToHelpDescription')}</p>
          <ContactForm showRoleSelector={false} initialRole="volunteer" title={tContact('defaultTitle')} />
        </div>

      </div>
    </div>
  )
}
