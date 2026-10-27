# Esquadro

Protótipo de app web para medição de ambientes.

- Projetos → áreas → uma base com esboços, fotos, notas e scans 3D juntos
- Esboço desenhado na tela; cada parede recebe a medida do laser (✓), digitada (✎) ou fica estimada pelo desenho (≈)
- Fotos com setas de medida, ligadas à parede correspondente do esboço
- Recebe medidas de trena laser por Bluetooth (Web Bluetooth)
- Importa planilha de medições (.xls)
- Exporta DXF 2D/3D (camadas PAREDE, PORTA, JANELA)
- Dados ficam só no aparelho (IndexedDB); backup por arquivo `.esquadro.json`
