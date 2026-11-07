import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from './routing'
import enMessages from '../messages/en.json'
import { getByPath } from '@/lib/messages-walk'

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // A key missing from a locale falls back to the English string, never the raw key path.
    getMessageFallback({ key, namespace }) {
      const fullKey = namespace ? `${namespace}.${key}` : key
      const en = getByPath(enMessages, fullKey)
      if (typeof en === 'string') return en
      return key.split('.').pop() ?? key
    },
  }
})
