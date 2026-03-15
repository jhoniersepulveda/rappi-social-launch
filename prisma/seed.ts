import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// ─── Products keyed by RAPPI_STORE_ID (from products.csv) ─────────────────────
type Product = { name: string; description: string; imageUrl: string | null; price: number }
const PRODUCTS: Record<string, Product[]> = {
  CO900482379: [
    { name: 'Mazorcada House y Gaseosa 250 ml',          description: 'Base de lechuga, tomate, cebolla, maíz tierno desgranado, carne, pollo asados, huevos revueltos, papas chips, salsa de tomate, salsa tártara, queso gratinado y gaseosa 250 ml a elegir.', imageUrl: 'https://images.rappi.com/products/d1f9232e-4923-47e5-beca-9f037b911af1.png', price: 47000 },
    { name: 'Salchipapa de Pollo y Gaseosa 250 ml',      description: 'Papas a la francesa, salchicha, pechuga asada, queso, maíz, tocineta, salsas de la casa y gaseosa 250 ml a elegir.',                                                                        imageUrl: 'https://images.rappi.com/products/046aa144-6921-40a3-94de-3bbb10b2e52a.png', price: 34400 },
    { name: 'Salchipapa Mexicana y Gaseosa 250 ml',      description: 'Papas a la francesa, salchicha, carne desmechada, pico de gallo, guacamole y crema agria, gaseosa 250 ml a elegir.',                                                                         imageUrl: 'https://images.rappi.com/products/98882515-52c2-4c8b-94e2-c2df768f7ddb.jpeg', price: 35400 },
    { name: 'Mazorcada Sencilla de Pollo y Gaseosa 250ml', description: 'Maíz tierno desgranado, pechuga asada, papas chips, salsa de tomate, salsa tártara, queso gratinado, gaseosa 250 ml a elegir.',                                                            imageUrl: 'https://images.rappi.com/products/a494e35b-1c4b-41e8-b15a-2f2848a5e80d.jpeg', price: 32200 },
    { name: 'Salchipapa Margarita y Gaseosa 250 ml',     description: 'Papas a la francesa, salchicha, maíz, jamón, queso, salsa de tomate y gaseosa 250 ml a elegir.',                                                                                             imageUrl: 'https://images.rappi.com/products/75751c69-09d9-48e9-b79a-9ee48c9569e4.png', price: 30800 },
  ],
  CO900482047: [
    { name: 'Brazo de Reina Porción',  description: 'Rollo de bizcochuelo bañado en dulce de melocotón, relleno de crema chantilly, fresa fresca y dulce de mora; decorado con crema, chocolate y fresa.', imageUrl: 'https://images.rappi.com/products/d2f37af9-9f23-46a9-8047-ca776d195f46.png', price: 8100 },
    { name: 'Yogurt litro',            description: 'Yogurt artesanal sin conservantes ni aditivos, leche entera pasteurizada, cultivo probiótico, fruta natural en almíbar, azúcar. 1 Litro',             imageUrl: 'https://images.rappi.com/products/7187d21b-07fb-4d5e-b4ba-114f8219e610.png', price: 22500 },
    { name: 'Mousse de Chocolate',     description: 'Tartaleta de galleta, rellena de espuma de chocolate, cubierta con baño de chocolate y grageas',                                                       imageUrl: 'https://images.rappi.com/products/d3e8b0a1-7f73-469a-9f0b-cc05c88f3537.png', price: 6000 },
    { name: 'Cheesecake personal',     description: 'Base de galleta, crema de queso y dulce de fruta natural.',                                                                                            imageUrl: 'https://images.rappi.com/products/2f6166fb-449d-4793-9b16-b83e1d2d6ad9.png', price: 10300 },
    { name: 'Mariposa x 3',           description: 'Hojaldre crocante, decorado con chocolate y grageas. 3 unidades',                                                                                      imageUrl: 'https://images.rappi.com/products/51799a43-1ec6-441e-99c5-2c16f94546ac.png', price: 14000 },
  ],
  CO900413538: [
    { name: 'Bondiola Ahumada',        description: 'Carne 300gr de bondiola ahumada al barril, ensalada de temporada, arepa & acompañante del día.',                                                      imageUrl: 'https://images.rappi.com/products/f3dc0f5f-796c-4213-a510-2f4632f4499f.jpeg', price: 45700 },
    { name: 'Molcajete',               description: 'Guacamole fresco de base para una bondiola de cerdo caramelizada, acompañada de acevichado de mango y patacones crujientes',                          imageUrl: 'https://images.rappi.com/products/e6a47efb-4bc2-41d8-9d04-e6309e4ee5fc.jpeg', price: 36500 },
    { name: 'Limonada Cerezada 16 Oz', description: 'Limonada de la casa sabor cereza',                                                                                                                    imageUrl: 'https://images.rappi.com/products/af6e2835-da06-4769-b2e2-a3b59ff6f237.jpeg', price: 13800 },
    { name: 'Picada Al Barril Pequeña', description: 'Bondiola, costillas, chicharrón, chorizo, morcilla, con papa al vapor, patacón & arepitas fritas 400gr, 2 salsas de la casa',                        imageUrl: 'https://images.rappi.com/products/dbd77ef1-e766-4b69-9585-5f008f49b40c.jpeg', price: 74400 },
    { name: 'Deditos de Queso',        description: 'Seis barras de cremoso queso mozzarella apanado, servidas con una exclusiva salsa dulce de la casa',                                                  imageUrl: 'https://images.rappi.com/products/2db40579-34b2-4c0a-bd37-757337f61f70.png', price: 27500 },
  ],
  CO900482253: [
    { name: 'Bowl Proteico de Pollo',         description: 'Pollo crispy con huevo duro, garbanzos, aguacate, pepino, pimentón, cebolla morada, tomate cherry y mix de lechugas, terminado con salsa de pimentón dulce y perejil fresco.',                                                      imageUrl: 'https://images.rappi.com/products/78f19656-15a9-44a0-82d0-5a057b373b4d.jpeg', price: 32000 },
    { name: 'Espagueti boloñesa',             description: 'Spaghetti con salsa bolognesa casera, terminado con mix de parmesano. Acompañado de pan francés con mantequilla de ajo y perejil y ensalada verde fresca.',                                                                          imageUrl: 'https://images.rappi.com/products/235912be-7517-493d-84fa-b4dcacd5095a.jpeg', price: 28800 },
    { name: 'Bowl Asiático de Cerdo Teriyaki', description: 'Cerdo en salsa teriyaki con arroz blanco con ajonjolí, acompañado de brócoli y zanahoria blanqueados.',                                                                                                                            imageUrl: 'https://images.rappi.com/products/65a37b2d-2a31-4983-8eec-435d5a35012f.jpeg', price: 47000 },
    { name: 'Bowl Griego de Camarones',       description: 'Camarones salteados sobre quinoa, con pepino, tomate cherry, cebolla morada encurtida, pimentón, aceitunas negras y verdes, queso campesino y mix de lechugas, terminado con vinagreta de limón.',                                 imageUrl: 'https://images.rappi.com/products/70ddc69f-a545-49f6-ad86-0f47fcca6b58.jpeg', price: 50000 },
    { name: 'CHURRASCO ARGENTINO',            description: 'Churrasco a la plancha con plátano maduro, papa salada con sour cream, ensalada fresca con mizuna.',                                                                                                                                imageUrl: 'https://images.rappi.com/products/273d2c49-f91e-4c15-ac1c-c7d8e5d18514.jpeg', price: 50000 },
  ],
  CO900482091: [
    { name: 'Pro Pollo',            description: 'Base: 1, Huerta: 3, Aderezo: 3, Crujientes: 3, Proteína: 120 gr pollo Guarnición: 2. 120 g.r',  imageUrl: 'https://images.rappi.com/products/187850bb-198d-4b75-9f4e-878f333ecb67.jpeg', price: 16000 },
    { name: 'Plus sin proteína',    description: 'Puedes elegir Base: 1, Huerta: 3, Aderezo: 1, Crujientes: 1,',                                   imageUrl: 'https://images.rappi.com/products/b9902dc5-9caa-4942-9275-ea0172b85a09.jpeg', price: 8000 },
    { name: 'Plus con proteína',    description: 'Puedes elegir Base: 1, Huerta: 3, Aderezo: 1, Crujientes: 1, Proteína: 30 gr de pollo',          imageUrl: 'https://images.rappi.com/products/3ed4fede-94cd-4864-9d28-6d7d464bd4b4.jpeg', price: 10000 },
    { name: 'Max Carne',            description: 'Base: 2, Huerta: 4, Aderezo: 4, Crujientes: 3, Proteína: 150 gr Carne Guarnición: 2. 150g.',    imageUrl: 'https://images.rappi.com/products/2ecac5a5-da20-4f62-9287-d79363a07f5d.jpeg', price: 21000 },
    { name: 'Guarnición (50g)',     description: 'Porción de 50g de guarnición a elección.',                                                       imageUrl: 'https://images.rappi.com/products/1914f429-ade1-4f9f-9259-37251d2fc780.jpeg', price: 1800 },
  ],
  CO900482334: [
    { name: 'Torta Doble chocolate x10',   description: 'Torta de Doble chocolate x 10 a 12 Porciones',                                                  imageUrl: 'https://images.rappi.com/products/14e7b0a3-2216-4739-a292-7346cef1ba37.png', price: 180000 },
    { name: 'Turron de almendras',         description: 'Mini Turrones de almendras Perrito Salchicha',                                                    imageUrl: 'https://images.rappi.com/products/df54af1c-6aa7-4174-844c-1640a3092f87.png', price: 20000 },
    { name: 'Pan de Banano y Agraz',       description: 'Pan batido de banano y agraz. Peso 500gr',                                                        imageUrl: 'https://images.rappi.com/products/6413d8ae-b09f-4ead-ab6b-47e807f8b195.png', price: 35000 },
    { name: 'Salsa de Caramelo Artesanal', description: 'Salsa de Caramelo artesanal 350gr, lista para Café latte, Waffles y postres.',                    imageUrl: 'https://images.rappi.com/products/095b8731-5afc-4a45-9588-c250e803ce9d.png', price: 32000 },
    { name: 'Torta Plátano Maduro y Arequipe', description: 'Tortas de Plátanos maduro, trozos de mozarella y cobertura de Arequipe 6 a 8 porciones.',    imageUrl: 'https://images.rappi.com/products/d419f405-70e1-4eaf-87e1-1ea07ba394b0.png', price: 89000 },
  ],
  CO900481966: [
    { name: 'Oreo Chocolate Jar',            description: 'Crema de chocolate con capas de oreo trituradas.',                                             imageUrl: 'https://images.rappi.com/products/tmpImga27c631b-c36a-430d-9560-9ceea7872116.png', price: 12900 },
    { name: 'Oreo Tres Leches Jar',          description: 'Base de torta de vainilla bañada en tres leches con topping de oreo triturada.',                imageUrl: 'https://images.rappi.com/products/tmpImg5c956563-db1e-44c0-bb09-efbefa5f189d.png', price: 12900 },
    { name: 'Porción De Fruta',              description: 'Porción de papaya y piña.',                                                                     imageUrl: 'https://images.rappi.com/products/tmpImg788383b0-a133-4826-88d4-77d1d26910a1.png', price: 8500 },
    { name: 'Galleta Avena Y Frutos Rojos',  description: 'Galleta de avena y canela con relleno de frutos rojos.',                                        imageUrl: 'https://images.rappi.com/products/tmpImgd4d4cd02-5583-4c75-887b-685646ba3190.png', price: 10900 },
    { name: 'Oreo Cheesecake Jar',           description: 'Crema de cheesecake con capas de oreo triturada.',                                              imageUrl: 'https://images.rappi.com/products/tmpImg395903a1-f42a-4aa5-a6e8-9fd9be983bcb.png', price: 12900 },
  ],
  CO900478571: [
    { name: 'Hamburguesa Playera',    description: 'Carne de res 200 g con queso, vegetales, tajada de plátano maduro, huevo, tocineta y chorizo de cerdo.', imageUrl: 'https://images.rappi.com/products/f4d86e94-9e82-4c13-8fa2-0726701c1348.png', price: 36300 },
    { name: 'Cazuela Montañera',      description: 'Arroz, frijol, carne molida, chorizo picado, maduro en cubos, arepa, huevo frito, hogao, guacamole y chicharrón.',  imageUrl: 'https://images.rappi.com/products/c845115e-ee3a-47d0-8298-d97eefc4de64.png', price: 30200 },
    { name: 'Churrasco',              description: 'Churrasco de 300 g acompañado de tajadas de maduro, papa francesa y ensalada.',                           imageUrl: 'https://images.rappi.com/products/a038b767-b9e7-48ed-8aa5-5ef0de8bf3cb.png', price: 46750 },
    { name: 'Hamburguesa de Pollo',   description: 'Pechuga de pollo apanada 200 g con pico de gallo, guacamole, mayonesa chipotle y queso.',                 imageUrl: 'https://images.rappi.com/products/1311c011-4f82-46c4-b8e0-e9dca8657438.png', price: 33250 },
    { name: 'Pechuga Napolitana',     description: 'Pechuga de 300 g gratinada con salsa napolitana, acompañada de papa francesa y ensalada.',                imageUrl: 'https://images.rappi.com/products/a69fabda-65b4-4e37-b9b5-4c0e65b46bb5.png', price: 46750 },
  ],
  CO900483121: [
    { name: 'Arma Tu Pizza 5 Ingredientes',  description: 'Pizza de 5 ingredientes y elije el tamaño y masa preferida.',     imageUrl: 'https://images.rappi.com/products/tmpImgde895e7d-1bf3-408f-90ab-0c7ea6788afc.png', price: 52900 },
    { name: 'Pizza Por Mitades Extra Grande', description: 'Pizza extra grande masa original por mitades.',                   imageUrl: 'https://images.rappi.com/products/tmpImgd21b8fc1-6a4c-47ee-9ab7-5907a5ccdf99.png', price: 67900 },
    { name: 'Arma Tu Pizza 4 Ingredientes',  description: 'Pizza de 4 ingredientes y elije el tamaño y masa preferida.',     imageUrl: 'https://images.rappi.com/products/tmpImg55f56172-1d1e-4c58-8e74-4ef2225e543c.png', price: 47900 },
    { name: 'Domiperro + Coca Cola Original 400ml', description: 'Domiperro + coca cola original 400ml',                    imageUrl: 'https://images.rappi.com/products/tmpImg3a6a0a67-5d87-4128-b8e9-3fe56c227424.png', price: 25400 },
    { name: 'Sprite Original 1.5lt',         description: 'Sprite 1.5 lts',                                                  imageUrl: 'https://images.rappi.com/products/tmpImg41e1783d-bc73-4aca-89c9-3f1d7cc63f59.png', price: 12500 },
  ],
  CO900482586: [
    { name: 'Ranchera con Chorizo Artesanal (2 personas)', description: 'Ranchera para dos personas con chorizo artesanal.',                  imageUrl: 'https://images.rappi.com/products/4b23ce92-2f8c-49ac-b300-d308a5ba2f59.png', price: 34000 },
    { name: 'Ranchera con Chorizo Artesanal (3 personas)', description: 'Ranchera para tres personas con chorizo artesanal.',                 imageUrl: 'https://images.rappi.com/products/4b23ce92-2f8c-49ac-b300-d308a5ba2f59.png', price: 48000 },
    { name: 'Ranchera con Pollo a la Plancha (2 personas)', description: 'Ranchera para dos personas con pollo a la plancha.',               imageUrl: 'https://images.rappi.com/products/8f26f2d7-e93b-4b8d-8473-22b6153cbb3e.png', price: 36000 },
    { name: 'Ranchera con Pollo a la Plancha (individual)', description: 'Ranchera individual con pollo a la plancha.',                      imageUrl: 'https://images.rappi.com/products/6746ae0a-2c8d-484c-9986-96d2eb3ee33c.png', price: 24000 },
    { name: 'Ranchera con Pollo y Chorizo Artesanal',      description: 'Ranchera para tres personas con pollo a la plancha y chorizo artesanal.', imageUrl: 'https://images.rappi.com/products/d720597d-e1f3-4ea3-85af-649798e54b41.png', price: 57000 },
  ],
  CO900482680: [
    { name: 'Porción de Papa',              description: 'Porción de papa.',                                                                imageUrl: 'https://images.rappi.com/products/91ba4206-9169-4255-8a5b-df7a1574c6af.jpeg', price: 7000 },
    { name: 'Salchi Sencilla',              description: 'Papas a la francesa con salchicha y salsas de la casa.',                          imageUrl: 'https://images.rappi.com/products/3d186e54-8237-4aba-b247-85cb933bf140.jpeg', price: 8000 },
    { name: 'Salchi Gratinada',             description: 'Papas a la francesa con salchicha bañadas en queso gratinado.',                   imageUrl: 'https://images.rappi.com/products/627b31ca-bab8-4f74-b9f1-9566cf1ebb8c.jpeg', price: 12000 },
    { name: 'Salchi Ranchera Gratinada +Tocineta', description: 'Papas con salchicha ranchera, queso gratinado y trozos de tocineta',      imageUrl: 'https://images.rappi.com/products/0c3c91bf-e558-48e7-ba5d-f56f24a1c5b1.jpeg', price: 16000 },
    { name: 'Salchi Ranchera Sencilla',     description: 'Papas a la francesa con salchicha ranchera y salsas especiales.',                 imageUrl: 'https://images.rappi.com/products/e6c44580-b60b-4879-a6cf-7ccef01f75e8.jpeg', price: 12000 },
  ],
  CO900482407: [
    { name: 'Pechuga Completa (400g)',      description: 'Yuca, Arepita, Platano Amarillo con queso, Salsa, Ensalada.',                                                           imageUrl: 'https://images.rappi.com/products/463cfdf2-e9b1-45c2-8044-ce184120f7cc.jpeg', price: 26000 },
    { name: 'Picada Rey Especial (280g)',   description: 'Cerdo al Barril, Chorizo de Cerdo, Yuca, Arepita, Platano Amarillo con queso, Salsa, Limón',                           imageUrl: 'https://images.rappi.com/products/676d8ab9-20e0-447b-88ca-976509e4e4eb.jpeg', price: 25000 },
    { name: 'Chuleta (300g)',               description: 'Yuca, Arepita, Platano Amarillo con queso, Salsa, Ensalada.',                                                           imageUrl: 'https://images.rappi.com/products/d5eae65e-38d3-4a3e-8e81-fa428ac08a67.jpeg', price: 16000 },
    { name: 'Picada Rey Personal (230g)',   description: 'Picada de 230g con cerdo al barril, chorizo de cerdo, yuca, arepita, plátano amarillo con queso, salsa y limón.',     imageUrl: 'https://images.rappi.com/products/e725abb2-9e6b-4885-8d2b-ec5ee8f0edcd.jpeg', price: 20000 },
    { name: 'Punta Gorda (400g)',           description: 'Punta Gorda de 400g acompañada de yuca, arepita, plátano amarillo con queso, salsa y ensalada.',                       imageUrl: 'https://images.rappi.com/products/5001c3da-4afb-4fc4-946c-a60e416bd8b0.jpeg', price: 30000 },
  ],
  CO900482570: [
    { name: 'Hamburguesa Colombiana', description: 'Carne de res 110 g, doble queso, tomate fresco, cebolla caramelizada, papitas fosforito, pan de hamburguesa.', imageUrl: 'https://images.rappi.com/products/64b47d35-ec4d-43e1-97d6-3f46cf20b33e.jpeg', price: 16900 },
    { name: 'Queso Extra',            description: 'Tajada adicional de queso.',                                                                                    imageUrl: 'https://images.rappi.com/products/45ce48ce-4ea9-4b5f-bbe3-c6101c1eedad.jpeg', price: 2000 },
    { name: 'Coca Cola 400 ml',       description: 'Bebida gaseosa individual 400 ml',                                                                              imageUrl: 'https://images.rappi.com/products/020f325c-53ee-4726-a837-493f063e50ab.jpeg', price: 6900 },
    { name: 'Carne Extra',            description: 'Porción adicional de carne de res.',                                                                            imageUrl: 'https://images.rappi.com/products/a9343d9b-7ca6-44b5-8b35-58c01c05fb47.jpeg', price: 5000 },
    { name: 'Gaseosa 1.5 L',          description: 'Bebida gaseosa para compartir.',                                                                                imageUrl: 'https://images.rappi.com/products/2ab48968-9ad9-47c9-8846-054a3c5aece3.jpeg', price: 12000 },
  ],
  CO900456150: [
    { name: 'Suspiro a la Limeña',          description: 'Suave manjar a base de arequipe, coronado con merengue italiano al pisco con aromas de canela y fresas',     imageUrl: 'https://images.rappi.com/products/a827aea9-bef6-4168-bbac-e7e5af4dd63e.jpeg', price: 23500 },
    { name: 'Corona 330 ml',                description: 'Cervezas',                                                                                                   imageUrl: 'https://images.rappi.com/products/8f35cb88-167d-4b74-af3e-9d249d144db2.png', price: 13500 },
    { name: 'Ceviche de Mariscos',          description: 'Variedad de mariscos en leche de tigre de la casa con chips de plátano, camote y cancha.',                   imageUrl: 'https://images.rappi.com/products/c9435aea-6bec-4580-ada0-d2fdfb62865e.jpeg', price: 82700 },
    { name: 'Cerveza Club Colombia Dorada', description: 'Tipo de cerveza: Lager. % Alcohol: 4.7%. País de origen: Colombia',                                          imageUrl: 'https://images.rappi.com/products/7c4e9ccc-de81-4dfa-bb6a-142417ed5fc2.jpg', price: 12000 },
    { name: 'Pescado a lo Macho',           description: 'Filete de pescado en salsa de ají panca con salsa criolla y papa criolla.',                                   imageUrl: 'https://images.rappi.com/products/3f96346a-6000-4c52-b8c0-b20048059b31.jpeg', price: 62200 },
  ],
  CO900482010: [
    { name: 'GATORADE',              description: 'Gatorade',                                                                       imageUrl: 'https://images.rappi.com/products/ee8f03a4-d832-4297-ba20-de87ada6e2cb.jpeg', price: 9000 },
    { name: 'Arepa de Chicharrón',   description: 'Arepa frita, cama de hogao 200 gramos de chicarrón, queso asado y limón',       imageUrl: 'https://images.rappi.com/products/de09b6be-8d43-4c41-bcd3-b8a19f135641.png', price: 37000 },
    { name: 'MANZANA 400 ML',        description: 'Manzana 400 ml',                                                                imageUrl: 'https://images.rappi.com/products/597959a9-0a55-4754-9468-5e563b22b487.jpeg', price: 9000 },
    { name: 'AGUA CRISTAL 600 ML',   description: 'Agua cristal 600 ml',                                                           imageUrl: 'https://images.rappi.com/products/91ddfcb3-7a08-46bc-b8bd-868c190d2cfe.jpeg', price: 5000 },
    { name: 'TE HATSU BLANCO',       description: 'Te hatsu blanco',                                                               imageUrl: 'https://images.rappi.com/products/791f1ad2-ee64-470e-ae80-3bc6e5ddf03c.jpeg', price: 11000 },
  ],
  CO900482807: [
    { name: 'Tinto 4 oz',                          description: 'Una taza',                                                        imageUrl: 'https://images.rappi.com/products/673edf0b-0fdc-4fc8-b2a7-242f10efffde.png', price: 3500 },
    { name: 'Arepa de maíz pollo desmechado',      description: 'Arepa con queso y pollo desmechado',                              imageUrl: 'https://images.rappi.com/products/e7a5ec35-4d8b-435c-95c9-ca2b24832bfd.jpeg', price: 10000 },
    { name: 'Colombiana 250ml',                    description: 'Gaseosa',                                                        imageUrl: 'https://images.rappi.com/products/56452b91-081f-4f50-993e-abcbbf9279b6.jpeg', price: 2700 },
    { name: 'Huevos revueltos con arroz y pan',    description: 'Porción de huevos revueltos acompañada de arroz y pan',          imageUrl: 'https://images.rappi.com/products/cdc78678-3aaf-4f2f-86ab-c70b5f2fdd34.png', price: 8500 },
    { name: 'Empanada Pollo queso',                description: 'Empanada de pollo con queso',                                    imageUrl: 'https://images.rappi.com/products/ea53ec0c-5c84-4f2f-895e-46387009cfb2.jpeg', price: 4000 },
  ],
  CO900483253: [
    { name: 'Pereza',       description: 'Bagel artesanal, salmón curado tipo gravlax, mayonesa de miso y eneldo, con ensalada de huevo americana.',                              imageUrl: 'https://images.rappi.com/products/ed3d7906-042e-44a4-a24c-ad34479ca03e.jpeg', price: 43000 },
    { name: 'Té Hatsu Negro', description: '400 ml',                                                                                                                            imageUrl: 'https://images.rappi.com/products/e22ff25e-1831-4ed7-8eb6-9c7fe48a54e0.jpeg', price: 9000 },
    { name: 'Agua Manantial', description: '600 ml',                                                                                                                            imageUrl: 'https://images.rappi.com/products/9ef55d0f-d3d9-429c-a2e8-c2d9c1bc0e22.jpeg', price: 8000 },
    { name: 'Soberbia',     description: 'Focaccia fermentada 48 horas, jamón serrano español, pesto de tomates secos, queso brie fundente y rúcula fresca.',                   imageUrl: 'https://images.rappi.com/products/2bcf046b-011d-4fcf-8ef3-64330812ce37.jpeg', price: 46000 },
    { name: 'Ira',          description: 'Pan bao taiwanés al vapor, panceta laqueada, mayonesa de sriracha picante, ensalada tailandesa. Contiene nueces.',                    imageUrl: 'https://images.rappi.com/products/95cc32ee-526a-4bb9-9114-c7c9201c541a.jpeg', price: 45000 },
  ],
  CO900436279: [
    { name: 'Empanada Vegetariana', description: 'Apio, zucchini y zanahoria',                                                                       imageUrl: 'https://images.rappi.com/products/6e68f92a-7020-4187-ac6f-8f739b6c3d84.jpeg', price: 5800 },
    { name: 'Empanada Espinaca',    description: 'Empanada rellena de espinaca, pollo desmechado y queso. con salsa a elegir',                        imageUrl: 'https://images.rappi.com/products/a4f69c82-5b59-4e8a-bde0-c7291adc0203.jpeg', price: 6000 },
    { name: 'Agua Brisa Manzana',   description: 'Agua saborizada Brisa Manzana presentación 600ml.',                                                 imageUrl: 'https://images.rappi.com/products/3d257efa-2da6-4bab-90cd-bc11ee1e9066.jpeg', price: 4000 },
    { name: 'Empanada Queso Arequipe', description: 'Empanada rellena de quesito con arequipe. con salsa a elegir',                                   imageUrl: 'https://images.rappi.com/products/35a3d873-95ff-43fb-856f-3692a4bb3b26.jpeg', price: 6000 },
    { name: 'Quatro 400ml',         description: 'Gaseosa Quatro presentación 400ml.',                                                                imageUrl: 'https://images.rappi.com/products/82a58a4e-555b-4796-b957-486b16c32b57.jpeg', price: 4000 },
  ],
  CO900482406: [
    { name: 'Agua 250 Ml',            description: 'Agua En Presentacion De 250 Ml.',                                                                                              imageUrl: 'https://images.rappi.com/products/ed80ea22-4340-47a9-884f-cd4925561a0d.jpeg', price: 2269 },
    { name: 'Ruta Extrema',           description: '16 alitas de pollo crujientes acompañadas de 250 g de papas a la francesa y salsas de la casa + Gaseosa econo litro postobon.', imageUrl: 'https://images.rappi.com/products/a7c3f13b-de89-4735-9993-b0d207b983d7.png', price: 39500 },
    { name: 'Tequeños Queso con Bocadillo', description: 'Deliciosos palitos de masa dorada y crujiente rellenos de queso y bocadillo.',                                           imageUrl: 'https://images.rappi.com/products/1e460bed-83bb-449c-9aaa-7eb841daacb6.png', price: 4000 },
    { name: 'Agua Saborizada 250 Ml', description: 'Agua Saborizada En Presentacion De 250 Ml.',                                                                                   imageUrl: 'https://images.rappi.com/products/2ce21b9b-de9b-4dfb-af60-2a54cd0d8d66.jpeg', price: 3403 },
    { name: 'Ruta Express',           description: '4 alitas de pollo crujientes acompañadas de 250 g de papas a la francesa y salsas de la casa.',                                imageUrl: 'https://images.rappi.com/products/2ec596d8-df52-4601-a3c5-a08f17a8e128.png', price: 16500 },
  ],
}

// ─── Restaurants from restaurants.csv ─────────────────────────────────────────
const restaurants = [
  { slug: 'co900482010', rappiId: 'CO900482010', name: 'CHICHARROUND Calle 9 42-15',                                category: 'Comida Rápida',  city: 'MEDELLIN',    country: 'CO', rappiUrl: 'https://www.rappi.com.co/restaurantes/900482010-chicharround',                  logoUrl: 'https://images.rappi.com/restaurants_logo/ed30c6b5-1186-40e0-8d46-7af9c12f5bc3-1772485091021.jpeg' },
  { slug: 'co900482407', rappiId: 'CO900482407', name: 'Cristo Rey Asadero',                                        category: 'Parrilla',       city: 'VALLEDUPAR',  country: 'CO', rappiUrl: 'https://www.rappi.com.co/restaurantes/900482407-cristo-rey-asadero',              logoUrl: 'https://images.rappi.com/restaurants_logo/962110679499476-1773245634617.jpg' },
  { slug: 'co900482406', rappiId: 'CO900482406', name: 'Ruta 153 Fast Food',                                        category: 'Comida Rápida',  city: 'VALLEDUPAR',  country: 'CO', rappiUrl: 'https://www.rappi.com.co/restaurantes/900482406-ruta-153-fast-food',              logoUrl: 'https://images.rappi.com/restaurants_logo/ruta-1772826232687.png' },
  { slug: 'co900482237', rappiId: 'CO900482237', name: 'La Panquequería Chicó - Turbo',                             category: 'Desayunos',      city: 'BOGOTA',      country: 'CO', rappiUrl: 'https://www.rappi.com.co/restaurantes/900482237-la-panquequeria-turbo',            logoUrl: 'https://images.rappi.com/restaurants_logo/vnncknkva-1759932627168-1772639958569.jpg' },
  { slug: 'co900482680', rappiId: 'CO900482680', name: 'Salchitodo tura Calle 83A 2B N-71',                         category: 'Comida Rápida',  city: 'CALI',        country: 'CO', rappiUrl: 'https://www.rappi.com.co/restaurantes/900482680-salchitodo-tura',                 logoUrl: 'https://images.rappi.com/restaurants_logo/530201ad-10a6-40f3-9a80-250bc9091ca4-1773169309174.jpeg' },
  { slug: 'co900482379', rappiId: 'CO900482379', name: 'Salchipapas y Mazorcadas de la Casa',                       category: 'Comida Rápida',  city: 'BOGOTA',      country: 'CO', rappiUrl: 'https://www.rappi.com.co/restaurantes/900482379-salchipapas-y-mazorcadas-de-la-casa', logoUrl: 'https://images.rappi.com/restaurants_logo/que-1772821033974.png' },
  { slug: 'co900482807', rappiId: 'CO900482807', name: 'Desayunos Kennedy ml',                                      category: 'Desayunos',      city: 'BOGOTA',      country: 'CO', rappiUrl: 'https://www.rappi.com.co/restaurantes/900482807-desayunos-kennedy-ml',             logoUrl: 'https://images.rappi.com/restaurants_logo/logo-1773069082562.png' },
  { slug: 'co900482586', rappiId: 'CO900482586', name: 'SALCHIPALACE',                                              category: 'Comida Rápida',  city: 'SANTA MARTA', country: 'CO', rappiUrl: 'https://www.rappi.com.co/restaurantes/900482586-salchipalace',                     logoUrl: 'https://images.rappi.com/restaurants_logo/961487af-194c-4673-a386-0c8a5ec3719b' },
  { slug: 'co900478571', rappiId: 'CO900478571', name: 'Gastromrk Avenida Carrera 7 156-80',                        category: 'Típica',         city: 'BOGOTA',      country: 'CO', rappiUrl: 'https://www.rappi.com.co/restaurantes/900478571-gastromrk',                        logoUrl: 'https://images.rappi.com/restaurants_logo/f25b130f-be1a-41a3-b375-2f30b08ea7d5-1770315607834.jpeg' },
  { slug: 'co900436279', rappiId: 'CO900436279', name: 'Conchita Empanadas Gourmet',                                category: 'Empanadas',      city: 'BOGOTA',      country: 'CO', rappiUrl: 'https://www.rappi.com.co/restaurantes/900436279-conchita-empanadas-gourmet',       logoUrl: 'https://images.rappi.com/restaurants_logo/etertert-1741195011391.png' },
  { slug: 'co900456150', rappiId: 'CO900456150', name: 'Chiclayo Cocina Peruana',                                   category: 'Internacional',  city: 'MEDELLIN',    country: 'CO', rappiUrl: 'https://www.rappi.com.co/restaurantes/900456150-chiclayo-cocina-peruana',           logoUrl: 'https://images.rappi.com/restaurants_logo/logo-1772466475290.png' },
  { slug: 'co900482047', rappiId: 'CO900482047', name: 'Mielana Pastelería Yogurtería Avenida Carrera 72 34 S-34',  category: 'Panadería',      city: 'BOGOTA',      country: 'CO', rappiUrl: 'https://www.rappi.com.co/restaurantes/900482047-mielana-pasteleria-yogurteria',    logoUrl: 'https://images.rappi.com/restaurants_logo/2f7ec7ed-7f39-45aa-b64a-26f46e8fbcf3-1772496014647.jpeg' },
  { slug: 'co900413538', rappiId: 'CO900413538', name: 'Carbonetto - Laureles',                                     category: 'Parrilla',       city: 'MEDELLIN',    country: 'CO', rappiUrl: 'https://www.rappi.com.co/restaurantes/900413538-carbonetto',                       logoUrl: 'https://images.rappi.com/restaurants_logo/ddd-1758980235479.png' },
  { slug: 'co900481966', rappiId: 'CO900481966', name: 'La Cuadra Desayunos Caseros Cartagena - Turbo',             category: 'Desayunos',      city: 'CARTAGENA',   country: 'CO', rappiUrl: 'https://www.rappi.com.co/restaurantes/900481966-la-cuadra-desayunos-caseros-turbo', logoUrl: 'https://images.rappi.com/restaurants_logo/897654356-1635354400292-1722024166306-1772471987372.png' },
  { slug: 'co900482334', rappiId: 'CO900482334', name: 'Agustín Maldonado Pastelería',                              category: 'Postres',        city: 'BOGOTA',      country: 'CO', rappiUrl: 'https://www.rappi.com.co/restaurantes/900482334-agustin-maldonado-pasteleria',     logoUrl: 'https://images.rappi.com/restaurants_logo/gfdd-1772734429932.png' },
  { slug: 'co900482253', rappiId: 'CO900482253', name: "PA' CALENTÁ Carrera 4 18-65",                               category: 'Saludable',      city: 'CALI',        country: 'CO', rappiUrl: 'https://www.rappi.com.co/restaurantes/900482253-pa-calenta',                       logoUrl: 'https://images.rappi.com/restaurants_logo/6667deb9-3343-4d8e-b1ec-b13039150387-1772656080732.png' },
  { slug: 'co900482091', rappiId: 'CO900482091', name: 'Salatti',                                                   category: 'Saludable',      city: 'BOGOTA',      country: 'CO', rappiUrl: 'https://www.rappi.com.co/restaurantes/900482091-salatti',                          logoUrl: 'https://images.rappi.com/restaurants_logo/207fc027-23dd-4bc0-9142-446c27745462-1773081170450.png' },
  { slug: 'co900482570', rappiId: 'CO900482570', name: 'CRUNCH SMASH BURGER Calle 76A 90 BIS-50',                   category: 'Hamburguesa',    city: 'BOGOTA',      country: 'CO', rappiUrl: 'https://www.rappi.com.co/restaurantes/900482570-crunch-smash-burger',              logoUrl: 'https://images.rappi.com/restaurants_logo/d2aad752-dd69-4ee6-b351-1aba0dd0c330-1772820902761.png' },
  { slug: 'co900483121', rappiId: 'CO900483121', name: "Domino´s Ciudad Álamos Fs",                                 category: 'Pizza',          city: 'CALI',        country: 'CO', rappiUrl: 'https://www.rappi.com.co/restaurantes/900483121-dominos-pizza',                    logoUrl: 'https://images.rappi.com/restaurants_logo/1-1773181977724-1773250626128.png' },
  { slug: 'co900483253', rappiId: 'CO900483253', name: 'PAN Y PECADO',                                              category: 'Comida Rápida',  city: 'BUCARAMANGA', country: 'CO', rappiUrl: 'https://www.rappi.com.co/restaurantes/900483253-pan-y-pecado',                     logoUrl: 'https://images.rappi.com/restaurants_logo/2013111699590561_page-0001-1773504624245.jpg' },
]

const REMOVE_SLUGS = ['el-corral-premium', 'amor-perfecto-cafe', 'freshii-colombia']

async function main() {
  // 1. Remove lingering test restaurants (cascade-safe)
  const oldRests = await prisma.restaurant.findMany({
    where: { slug: { in: REMOVE_SLUGS } },
    select: { id: true, name: true },
  })
  if (oldRests.length > 0) {
    const ids    = oldRests.map(r => r.id)
    const kits   = await prisma.graphicKit.findMany({ where: { restaurantId: { in: ids } }, select: { id: true } })
    const kitIds = kits.map(k => k.id)
    if (kitIds.length) {
      await prisma.verification.deleteMany({ where: { kitId: { in: kitIds } } })
      await prisma.incentive.deleteMany({ where: { kitId: { in: kitIds } } })
      await prisma.graphicKit.deleteMany({ where: { id: { in: kitIds } } })
    }
    await prisma.incentive.deleteMany({ where: { restaurantId: { in: ids } } })
    await prisma.restaurant.deleteMany({ where: { id: { in: ids } } })
    console.log(`Removed ${oldRests.length} test restaurant(s)`)
  }

  // 2. Upsert restaurants + products
  let totalProducts = 0
  for (const r of restaurants) {
    const products = PRODUCTS[r.rappiId] ?? []
    totalProducts += products.length

    await prisma.restaurant.upsert({
      where:  { slug: r.slug },
      update: { name: r.name, category: r.category, logoUrl: r.logoUrl, city: r.city, country: r.country, rappiUrl: r.rappiUrl, topProducts: products },
      create: { slug: r.slug, name: r.name, category: r.category, logoUrl: r.logoUrl, city: r.city, country: r.country, rappiUrl: r.rappiUrl, email: null, topProducts: products },
    })

    const suffix = products.length > 0 ? ` — ${products.length} productos` : ' — sin productos aún'
    console.log(`  ✓ [${r.rappiId}] ${r.name}${suffix}`)
  }

  console.log(`\n✅ ${restaurants.length} restaurantes · ${totalProducts} productos`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
