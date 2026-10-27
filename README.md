# SAW Medição

Protótipo de app de medição de ambientes da SAW Móveis (móveis planejados).

- Projetos → áreas (cômodos) → planta por paredes, portas/janelas, fotos com setas, notas
- Recebe medidas do laser Bosch GLM 50 C por Bluetooth (Web Bluetooth; no iPhone use o navegador Bluefy)
- Importa a planilha de medições do Bosch MeasureOn (.xls)
- Exporta DXF 2D/3D para o Promob
- Dados ficam só no aparelho (IndexedDB); backup por arquivo `.sawmed.json`

Protocolo Bluetooth do GLM baseado em projetos da comunidade, não em documentação da Bosch.
