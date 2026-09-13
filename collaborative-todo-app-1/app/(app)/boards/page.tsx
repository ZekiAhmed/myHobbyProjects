import { getRequiredSession } from '@/lib/session'
import { signOut } from '@/app/actions/auth'

export default async function BoardsPage() {
  const session = await getRequiredSession()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Kanban Boards</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {session.user.email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-gray-600">Welcome to your boards! This is a placeholder page.</p>
      </main>
    </div>
  )
}
