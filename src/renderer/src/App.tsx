import { HashRouter, Route, Routes } from 'react-router'
import { ConfirmProvider } from './components'
import Preview from './pages/Preview'

const App = () => {
  return (
    <ConfirmProvider>
      <HashRouter>
        <div aria-hidden="true" className="drag-region fixed inset-x-0 top-0 z-10 h-6" />
        <Routes>
          <Route path="*" element={<Preview />} />
        </Routes>
      </HashRouter>
    </ConfirmProvider>
  )
}

App.displayName = 'App'

export default App
