import { HashRouter, Navigate, Route, Routes } from 'react-router'
import Home from './pages/Home'
import Preview from './pages/Preview'

const App = () => {
  return (
    <HashRouter>
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
