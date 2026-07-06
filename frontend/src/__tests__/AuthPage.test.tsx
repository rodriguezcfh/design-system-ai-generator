import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AuthPage from '../pages/AuthPage'

const mockLogin = vi.fn()
const mockSignup = vi.fn()
const mockNavigate = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import { useAuth } from '../contexts/AuthContext'

function setup(isAuthenticated = false) {
  vi.mocked(useAuth).mockReturnValue({
    isAuthenticated,
    auth: null,
    login: mockLogin,
    signup: mockSignup,
    logout: vi.fn(),
  })

  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  )
}

function getForm() {
  return document.querySelector('form')!
}

describe('AuthPage', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders login form by default', () => {
    setup()
    expect(screen.getByPlaceholderText('hola@empresa.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByText('Iniciá sesión para continuar')).toBeInTheDocument()
  })

  it('calls login with email and password on form submit', async () => {
    mockLogin.mockResolvedValue(undefined)
    setup()

    fireEvent.change(screen.getByPlaceholderText('hola@empresa.com'), { target: { value: 'user@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret123' } })
    fireEvent.submit(getForm())

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@test.com', 'secret123')
    })
  })

  it('shows error message when login fails', async () => {
    mockLogin.mockRejectedValue(new Error('Credenciales inválidas'))
    setup()

    fireEvent.change(screen.getByPlaceholderText('hola@empresa.com'), { target: { value: 'x@x.com' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrongpass' } })
    fireEvent.submit(getForm())

    await waitFor(() => {
      expect(screen.getByText('Credenciales inválidas')).toBeInTheDocument()
    })
  })

  it('switches to signup mode and shows correct placeholder', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Registrarse' }))
    expect(screen.getByPlaceholderText('Mínimo 8 caracteres')).toBeInTheDocument()
    expect(screen.getByText('Creá tu cuenta gratis')).toBeInTheDocument()
  })

  it('calls signup with email and password', async () => {
    mockSignup.mockResolvedValue(undefined)
    setup()

    fireEvent.click(screen.getByRole('button', { name: 'Registrarse' }))
    fireEvent.change(screen.getByPlaceholderText('hola@empresa.com'), { target: { value: 'new@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), { target: { value: 'password123' } })
    fireEvent.submit(getForm())

    await waitFor(() => {
      expect(mockSignup).toHaveBeenCalledWith('new@test.com', 'password123')
    })
  })

  it('clears error when switching between login and signup', async () => {
    mockLogin.mockRejectedValue(new Error('Error de prueba'))
    setup()

    fireEvent.change(screen.getByPlaceholderText('hola@empresa.com'), { target: { value: 'x@x.com' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'pass' } })
    fireEvent.submit(getForm())

    await waitFor(() => expect(screen.getByText('Error de prueba')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Registrarse' }))
    expect(screen.queryByText('Error de prueba')).not.toBeInTheDocument()
  })
})
