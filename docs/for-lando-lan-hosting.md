# For Lando's list: joining Blaney's R62D from Lando's LAN

Blaney hosts R62D on blaney-pc over the homelab VPN. Lando wants to join from a machine on his LAN.
Nothing in the game is in the way. Checked 2026-11-03:

- blaney-pc opens port 6262 (`r62d = { enable = true; openFirewall = true; }` in `hosts/blaney-pc/apps.nix`)
  and the game listens on every network when hosting.
- blaney-pc's VPN address is 10.10.0.5. Its WireGuard client only accepts traffic from
  `192.168.1.76/32;10.10.0.2/32;10.10.0.11/32;` (`allowedIPs` in `hosts/blaney-pc/networking.nix`).
  Any other LAN machine is dropped, even if the homelab forwards it.

Two things to do, both on Lando's side:

1. Homelab firewall: pass TCP 6262 from the LAN to 10.10.0.5.
2. Either masquerade that traffic so it arrives from an address on the list above, or add the LAN machine
   (or the LAN range) to `allowedIPs` on blaney-pc.

To check: with Blaney's VPN on and R62D open on HOST, open `http://10.10.0.5:6262` from the LAN machine.
Not tested end to end yet. The VPN was off when this was written, so the VPN side was read from the config only.
