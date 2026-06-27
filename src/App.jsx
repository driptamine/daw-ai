import { styled } from '@linaria/react'
import { useState, useEffect } from 'react'
import TopBar from './components/TopBar/TopBar'
import ChannelRack from './components/ChannelRack/ChannelRack'
import PianoRoll from './components/PianoRoll/PianoRoll'
import Mixer from './components/Mixer/Mixer'
import BrowserSidebar from './components/BrowserSidebar/BrowserSidebar'
import Playlist from './components/Playlist/Playlist'
import DraggableWindow from './components/DraggableWindow/DraggableWindow'
import { useStore } from './store/useStore'
import { theme } from './styles/theme'

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: ${theme.bg};
`

const MainArea = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
`

const ContentArea = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
  overflow: hidden;
`

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { getState, subscribe } = useStore()
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    return subscribe(() => forceUpdate((n) => n + 1))
  }, [subscribe])

  return (
    <AppContainer>
      <TopBar />
      <MainArea>
        <BrowserSidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((o) => !o)}
        />
        <ContentArea>
          {getState().windowVisibility.channelRack && (
            <DraggableWindow id="channelRack" title="Channel Rack">
              <ChannelRack />
            </DraggableWindow>
          )}
          {getState().windowVisibility.pianoRoll && (
            <DraggableWindow id="pianoRoll" title="Piano Roll">
              <PianoRoll />
            </DraggableWindow>
          )}
          {getState().windowVisibility.playlist && (
            <DraggableWindow id="playlist" title="Playlist">
              <Playlist />
            </DraggableWindow>
          )}
          {getState().windowVisibility.mixer && (
            <DraggableWindow id="mixer" title="Mixer">
              <Mixer />
            </DraggableWindow>
          )}
        </ContentArea>
      </MainArea>
    </AppContainer>
  )
}

export default App
