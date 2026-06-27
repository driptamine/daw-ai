/* eslint-disable react/prop-types */
import { styled } from '@linaria/react'
import { theme, fontSize } from '../../styles/theme'
import { useState, useEffect } from 'react'
import { useStore } from '../../store/useStore'

const Sidebar = styled.div`
  background: ${theme.panelBg};
  border-right: 1px solid ${theme.panelBorder};
  display: flex;
  flex-direction: column;
  width: ${({ $open }) => ($open ? '220px' : '0px')};
  min-width: ${({ $open }) => ($open ? '220px' : '0px')};
  overflow: hidden;
  transition: width 0.15s ease, min-width 0.15s ease;
  flex-shrink: 0;
`

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-bottom: 1px solid ${theme.panelBorder};
  white-space: nowrap;
`

const Title = styled.span`
  color: ${theme.text};
  font-size: ${fontSize.sm};
  font-weight: 600;
`

const SearchBar = styled.input`
  background: ${theme.surface};
  border: 1px solid ${theme.panelBorder};
  border-radius: 3px;
  color: ${theme.text};
  font-size: ${fontSize.xs};
  padding: 4px 6px;
  margin: 6px 8px;
  outline: none;
  width: calc(100% - 16px);
  flex-shrink: 0;

  &:focus {
    border-color: ${theme.accent};
  }

  &::placeholder {
    color: ${theme.textDim};
  }
`

const TreeContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
`

const Section = styled.div`
  margin-bottom: 2px;
`

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: ${fontSize.xs};
  color: ${theme.text};
  font-weight: 600;
  background: ${({ $open }) => ($open ? '#222' : 'transparent')};

  &:hover {
    background: #252525;
  }
`

const Arrow = styled.span`
  color: ${theme.textDim};
  font-size: 8px;
  transition: transform 0.1s;
  transform: ${({ $open }) => ($open ? 'rotate(90deg)' : 'rotate(0deg)')};
  display: inline-block;
`

const ItemList = styled.div`
  overflow: hidden;
  max-height: ${({ $open }) => ($open ? '400px' : '0px')};
  transition: max-height 0.15s ease;
`

const Item = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px 3px 24px;
  cursor: pointer;
  font-size: ${fontSize.xs};
  color: ${theme.textDim};

  &:hover {
    background: #222;
    color: ${theme.text};
  }
`

const Icon = styled.span`
  font-size: 10px;
  width: 14px;
  text-align: center;
  flex-shrink: 0;
`

const ToggleBtn = styled.button`
  position: absolute;
  left: ${({ $sidebarOpen }) => ($sidebarOpen ? '220px' : '0px')};
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 40px;
  background: ${theme.surface};
  border: 1px solid ${theme.panelBorder};
  border-left: none;
  border-radius: 0 3px 3px 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.textDim};
  font-size: 8px;
  z-index: 10;
  transition: left 0.15s ease;
  padding: 0;

  &:hover {
    background: ${theme.surfaceRaised};
    color: ${theme.text};
  }
`

const FolderIcon = () => <Icon>📁</Icon>
const FileIcon = () => <Icon>🎵</Icon>

const folders = [
  {
    name: 'Current Project',
    open: true,
    icon: '⚡',
    items: [
      { name: 'Patterns', icon: '🎹' },
      { name: 'Channels', icon: '🔊' },
      { name: 'Playlist', icon: '📋' },
      { name: 'Mixer', icon: '🎚' },
    ],
  },
  {
    name: 'Packs',
    open: false,
    icon: '📦',
    items: [
      { name: 'Drums', icon: '🥁', sub: ['808 Kit', 'Acoustic', 'Electronic'] },
      { name: 'Bass', icon: '🎸', sub: ['Sub Bass', 'Synth Bass'] },
      { name: 'Synths', icon: '🎹', sub: ['Lead', 'Pad', 'Pluck'] },
      { name: 'FX', icon: '🔊', sub: ['Risers', 'Impacts', 'Atmospheres'] },
    ],
  },
  {
    name: 'Projects',
    open: false,
    icon: '💾',
    items: [
      { name: 'dawdex_demo', type: 'file' },
      { name: 'beat_idea_01', type: 'file' },
      { name: 'remix_project', type: 'file' },
    ],
  },
  {
    name: 'Presets',
    open: false,
    icon: '🎛',
    items: [
      { name: 'Synth1', type: 'file' },
      { name: 'Sytrus', type: 'file' },
      { name: 'Harmless', type: 'file' },
    ],
  },
]

function FolderSection({ section }) {
  const [open, setOpen] = useState(section.open ?? true)

  const renderItems = (items) =>
    items.map((item, i) => {
      if (item.sub) {
        return <SubFolder key={i} item={item} depth={1} />
      }
      return (
        <Item key={i}>
          {item.icon ? <Icon>{item.icon}</Icon> : <FileIcon />}
          {item.name}
        </Item>
      )
    })

  return (
    <Section>
      <SectionHeader $open={open} onClick={() => setOpen(!open)}>
        <Arrow $open={open}>▶</Arrow>
        <Icon>{section.icon}</Icon>
        {section.name}
      </SectionHeader>
      <ItemList $open={open}>
        {renderItems(section.items)}
      </ItemList>
    </Section>
  )
}

function SubFolder({ item, depth }) {
  const [open, setOpen] = useState(false)
  const pad = 24 + depth * 16

  return (
    <>
      <Item style={{ paddingLeft: pad }} onClick={() => setOpen(!open)}>
        <Arrow $open={open} style={{ marginRight: 2 }}>▶</Arrow>
        <FolderIcon />
        {item.name}
      </Item>
      {open && item.sub.map((sub, i) => (
        <Item key={i} style={{ paddingLeft: pad + 20 }}>
          <FileIcon />
          {sub}
        </Item>
      ))}
    </>
  )
}

export default function BrowserSidebar({ open, onToggle }) {
  const { getState, subscribe } = useStore()
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    return subscribe(() => forceUpdate((n) => n + 1))
  }, [subscribe])

  const state = getState()

  return (
    <div style={{ position: 'relative', display: 'flex' }}>
      <Sidebar $open={open}>
        <Header>
          <Title>Browser</Title>
          <span style={{ fontSize: fontSize.xs, color: theme.textDim }}>
            {state.channels.length} ch
          </span>
        </Header>
        <SearchBar type="text" placeholder="Search browser..." />
        <TreeContainer>
          {folders.map((section, i) => (
            <FolderSection key={i} section={section} />
          ))}
        </TreeContainer>
      </Sidebar>
      <ToggleBtn
        $sidebarOpen={open}
        onClick={onToggle}
        title={open ? 'Close browser' : 'Open browser'}
      >
        {open ? '◀' : '▶'}
      </ToggleBtn>
    </div>
  )
}
