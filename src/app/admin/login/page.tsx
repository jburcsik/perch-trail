'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function AdminLoginPage() {
  const router = useRouter()
  const [notAllowed, setNotAllowed] = useState(false)

  useEffect(() => {
    // A session alone is not enough: the email must be on the admin allowlist,
    // which /api/admin/me checks with the same rule as the middleware.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) return
      fetch('/api/admin/me')
        .then((r) => (r.ok ? router.replace('/admin') : setNotAllowed(true)))
        .catch(() => setNotAllowed(true))
    })

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin Login</CardTitle>
        </CardHeader>
        <CardContent>
          {notAllowed ? (
            <div className="space-y-3" data-testid="admin-not-allowed">
              <p className="text-sm text-gray-700">This account is not on the admin list.</p>
              <Button variant="outline" onClick={() => { supabase.auth.signOut(); setNotAllowed(false) }}>Sign out</Button>
            </div>
          ) : (
            <Auth
              supabaseClient={supabase}
              appearance={{ theme: ThemeSupa }}
              providers={[]}
              onlyThirdPartyProviders={false}
              view="sign_in"
              showLinks={false}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
