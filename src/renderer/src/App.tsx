import { HashRouter, Navigate, Route, Routes } from 'react-router'
import Home from './pages/Home'
import Preview from './pages/Preview'

const App = () => {
  return (
    <HashRouter>
      <div aria-hidden="true" className="drag-region fixed inset-x-0 top-0 z-50 h-6" />
      <Routes>
        <Route index element={<Home />} />
        <Route path="preview" element={<Preview />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

App.displayName = 'App'

export default App
