'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Heart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { trackLikeHouse } from '@/lib/analytics'

const STORAGE_KEY = 'pp_liked_houses_v1'

function loadLiked(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function saveLiked(s: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]))
  } catch {
    // localStorage can fail (Safari private mode, full quota). Ignore; the
    // user just won't get persistence.
  }
}

type LikeButtonProps = {
  qrCodeId: string
  className?: string
}

export function LikeButton({ qrCodeId, className }: LikeButtonProps) {
  const t = useTranslations('LikeButton')
  const [count, setCount] = useState<number | null>(null)
  const [hasLiked, setHasLiked] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setHasLiked(loadLiked().has(qrCodeId))
  }, [qrCodeId])

  useEffect(() => {
    let cancelled = false
    supabase
      .from('house_likes')
      .select('count')
      .eq('qr_code_id', qrCodeId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setCount(data?.count ?? 0)
      })
    return () => { cancelled = true }
  }, [qrCodeId])

  const onClick = async () => {
    if (hasLiked || busy) return
    setBusy(true)
    // Optimistic
    setHasLiked(true)
    setCount((c) => (c ?? 0) + 1)
    try {
      const res = await fetch('/api/house/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_code_id: qrCodeId }),
      })
      if (!res.ok) {
        // Roll back on failure
        setHasLiked(false)
        setCount((c) => (c ?? 1) - 1)
        return
      }
      const data = await res.json()
      if (typeof data.count === 'number') setCount(data.count)
      const liked = loadLiked()
      liked.add(qrCodeId)
      saveLiked(liked)
      trackLikeHouse(qrCodeId)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={hasLiked || busy}
      aria-label={hasLiked ? t('likedAriaLabel', { count: count ?? 0 }) : t('likeAriaLabel', { count: count ?? 0 })}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
        hasLiked
          ? 'border-red-200 bg-red-50 text-red-700 cursor-default'
          : 'border-gray-200 bg-white text-gray-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700'
      } ${className ?? ''}`}
    >
      <Heart
        className={`h-4 w-4 ${hasLiked ? 'fill-red-500 text-red-500' : ''}`}
        aria-hidden="true"
      />
      <span>{count ?? '\u2014'}</span>
    </button>
  )
}
