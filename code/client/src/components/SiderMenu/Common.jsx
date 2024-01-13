import HarmonyLogo from '../../assets/harmony.svg'
import ModuloLogo from '../../assets/modulo-logo-h.png'
import config from '../../config'

export const RouteActionMap = {
  show: 'wallet',
  nft: 'wallet/nft',
  assets: 'wallet/assets',
  swap: 'wallet/swap',
  stake: 'wallet/stake',
  restore: 'internal/restore',
  tool: 'internal/tool',
}

export const mobileMenuItemStyle = {
  padding: '0 10px',
  fontSize: 12
}

export const Logos = {
  harmony: HarmonyLogo,
  modulo: ModuloLogo,
}
export const Logo = Logos[config.logoId] ?? ModuloLogo
