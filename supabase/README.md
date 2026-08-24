# El diseño de la base de datos

Cada archivo de `migrations/` es un cambio a la base, en orden.
Juntos son la receta completa: con ellos se puede reconstruir la base
desde cero si algún día hiciera falta.

Se generan solos cuando aplico un cambio. **No los edites a mano**:
si algo hay que corregir, se agrega un archivo nuevo encima.

El nombre lleva la fecha y la hora al frente para que el orden sea claro.
