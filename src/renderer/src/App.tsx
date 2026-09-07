import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { ConfirmProvider } from './components'
import Home from './pages/Home'
import New from './pages/New'
import Preview from './pages/Preview'
import Settings from './pages/Settings'
import ThemeList from './pages/Settings/Themes'
import ThemeEditor from './pages/Settings/Themes/Editor'

const App = () => {
  return (
    <ConfirmProvider>
      <HashRouter>
        <div aria-hidden="true" className="drag-region fixed inset-x-0 top-0 z-10 h-6" />
        <Routes>
          <Route path="/" element={<Home />}>
            <Route index element={<New />} />
            <Route path="preview" element={<Preview />} />
          </Route>
          <Route path="/settings" element={<Settings />}>
            <Route index element={<Navigate to="themes" replace />} />
            <Route path="themes" element={<ThemeList />} />
            <Route path="themes/new" element={<ThemeEditor />} />
            <Route path="themes/:id" element={<ThemeEditor />} />
            <Route path="*" element={<Navigate to="/settings/themes" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </ConfirmProvider>
  )
}

App.displayName = 'App'

export default App
