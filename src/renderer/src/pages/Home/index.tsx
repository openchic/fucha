import type { ArticleSummary } from '@shared/store-types'
import { PageBridgeContext, type PageBridge } from '@shared/pageBridge'
import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { Sidebar } from '../../components'
import { useArticleHistory } from '../../hooks'

/** Home 布局：左侧历史栏常驻，右侧承载 index（New）与 preview 子路由 */
const Home = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const history = useArticleHistory()
  const [page, setPage] = useState<PageBridge | null>(null)

  const openNew = (): void => {
    navigate('/')
  }

  const openHistory = (item: ArticleSummary): void => {
    navigate(`/preview?url=${encodeURIComponent(item.finalUrl)}&hash=${item.hash}`)
  }

  const deleteHistory = async (item: ArticleSummary): Promise<void> => {
    const activeHash = page?.activeHash
    await window.fucha.deleteArticle(item.hash)
    if (item.hash === activeHash) navigate('/')
    history.refresh()
  }

  const openSettings = (): void => {
    navigate('/settings/themes', {
      state: { returnTo: `${location.pathname}${location.search}` },
    })
  }

  return (
    <PageBridgeContext.Provider value={{ setPage, refreshHistory: history.refresh }}>
      <main className="flex h-full overflow-hidden bg-panel">
        <Sidebar
          items={history.items}
          ready={history.ready}
          error={history.error}
          activeHash={page?.activeHash}
          onNew={openNew}
          onOpen={openHistory}
          onDelete={deleteHistory}
          onSettings={openSettings}
        />
        <div className="flex min-w-0 flex-1 flex-col bg-panel py-2 pr-2">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(29,29,31,0.05)]">
            <Outlet />
          </div>
        </div>
      </main>
    </PageBridgeContext.Provider>
  )
}

Home.displayName = 'Home'

export default Home
