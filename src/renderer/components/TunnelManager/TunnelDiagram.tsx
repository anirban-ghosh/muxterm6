import React from 'react'
import type { TunnelType } from '@shared/tunnel-types'

interface TunnelDiagramProps {
  type: TunnelType
  localPort: string
  remoteHost: string
  remotePort: string
  sshHost: string
}

export const TunnelDiagram: React.FC<TunnelDiagramProps> = ({
  type,
  localPort,
  remoteHost,
  remotePort,
  sshHost
}) => {
  const lp = localPort || '?'
  const rh = remoteHost || '?'
  const rp = remotePort || '?'
  const ssh = sshHost || '?'

  return (
    <div className="tunnel-diagram">
      {type === 'local' && (
        <>
          <div className="tunnel-diagram__box tunnel-diagram__box--local">
            <div className="tunnel-diagram__label">Your Machine</div>
            <div className="tunnel-diagram__port">:{lp}</div>
          </div>
          <div className="tunnel-diagram__arrow">
            <span className="tunnel-diagram__arrow-line" />
            <span className="tunnel-diagram__arrow-label">SSH</span>
          </div>
          <div className="tunnel-diagram__box tunnel-diagram__box--server">
            <div className="tunnel-diagram__label">{ssh}</div>
          </div>
          <div className="tunnel-diagram__arrow">
            <span className="tunnel-diagram__arrow-line" />
          </div>
          <div className="tunnel-diagram__box tunnel-diagram__box--remote">
            <div className="tunnel-diagram__label">{rh}</div>
            <div className="tunnel-diagram__port">:{rp}</div>
          </div>
        </>
      )}
      {type === 'remote' && (
        <>
          <div className="tunnel-diagram__box tunnel-diagram__box--remote">
            <div className="tunnel-diagram__label">Remote Client</div>
          </div>
          <div className="tunnel-diagram__arrow">
            <span className="tunnel-diagram__arrow-line" />
          </div>
          <div className="tunnel-diagram__box tunnel-diagram__box--server">
            <div className="tunnel-diagram__label">{ssh}</div>
            <div className="tunnel-diagram__port">:{rp}</div>
          </div>
          <div className="tunnel-diagram__arrow">
            <span className="tunnel-diagram__arrow-line" />
            <span className="tunnel-diagram__arrow-label">SSH</span>
          </div>
          <div className="tunnel-diagram__box tunnel-diagram__box--local">
            <div className="tunnel-diagram__label">Your Machine</div>
            <div className="tunnel-diagram__port">:{lp}</div>
          </div>
        </>
      )}
      {type === 'dynamic' && (
        <>
          <div className="tunnel-diagram__box tunnel-diagram__box--local">
            <div className="tunnel-diagram__label">Your Machine</div>
            <div className="tunnel-diagram__port">:{lp} (SOCKS5)</div>
          </div>
          <div className="tunnel-diagram__arrow">
            <span className="tunnel-diagram__arrow-line" />
            <span className="tunnel-diagram__arrow-label">SSH</span>
          </div>
          <div className="tunnel-diagram__box tunnel-diagram__box--server">
            <div className="tunnel-diagram__label">{ssh}</div>
          </div>
          <div className="tunnel-diagram__arrow">
            <span className="tunnel-diagram__arrow-line" />
          </div>
          <div className="tunnel-diagram__box tunnel-diagram__box--remote">
            <div className="tunnel-diagram__label">Any Destination</div>
          </div>
        </>
      )}
    </div>
  )
}
