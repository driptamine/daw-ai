import { styled } from '@linaria/react'
import { theme, fontSize } from '../../styles/theme'
import { useStore } from '../../store/useStore'
import { useEffect, useState } from 'react'

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  background: ${theme.surface};
  border-bottom: 1px solid ${theme.panelBorder};
`

const Tab = styled.button<{ $active: boolean }>`
  background: ${({ $active }) => ($active ? theme.accent : 'transparent')};
  color: ${({ $active }) => ($active ? '#000' : theme.text)};
  border: 1px solid ${({ $active }) => ($active ? theme.accent : theme.panelBorder)};
  border-radius: 3px;
  padding: 3px 10px;
  font-size: ${fontSize.sm};
  cursor: pointer;
  font-weight: ${({ $active }) => ($active ? 600 : 400)};

  &:hover {
    background: ${({ $active }) => ($active ? theme.accentBright : theme.surfaceRaised)};
  }
`

const AddBtn = styled.button`
  background: transparent;
  border: 1px dashed ${theme.textDim};
  color: ${theme.textDim};
  border-radius: 3px;
  padding: 3px 8px;
  font-size: ${fontSize.sm};
  cursor: pointer;

  &:hover {
    border-color: ${theme.accent};
    color: ${theme.accent};
  }
`

export default function PatternSelector() {
  const { getState, subscribe } = useStore()
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    return subscribe(() => forceUpdate((n) => n + 1))
  }, [subscribe])

  const state = getState()
  const { patterns, currentPattern } = state

  return (
    <Container>
      {patterns.map((p) => (
        <Tab key={p.id} $active={p.id === currentPattern}>
          {p.name}
        </Tab>
      ))}
      <AddBtn>+</AddBtn>
    </Container>
  )
}
