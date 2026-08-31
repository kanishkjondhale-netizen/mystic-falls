/* The printed menu, transcribed from the cafe's own card.
   This is the seed for the database: `npm run init-db` loads it into
   Turso, and after that the live prices come from the `items` table
   (edit them at /admin). Change things here only to add or rename
   dishes, then re-run init-db. */

export const CAFE = {
  code:"0125", name:"MY$TIC FALLS", kind:"CAFÉ",
  place:"Anand Nagar, Nanded",
  insta:"@0125_MYSTIC_FALLS",
  wifi:"Nyc@0125"
};

export const MENU = [
 { id:"coffee", name:"Coffee", items:[
   {id:"cf1", descr:"Hot milky filter-style coffee, lightly sweet.", name:"Regular Coffee", price:50},
   {id:"cf2", descr:"Stronger and creamier, served hot in a small cup.", name:"Thick Coffee", price:70},
   {id:"cf3", descr:"Hot coffee with cocoa — rich, mildly sweet.", name:"Chocolate Coffee", price:80},
   {id:"cf4", descr:"Blended cold coffee, thick and frothy over ice.", name:"Crush Cold Coffee", price:90},
   {id:"cf5", descr:"Cold coffee topped with a scoop of ice-cream.", name:"Cold Coffee with Ice-Cream", price:100}
 ]},
 { id:"shakes", name:"Shakes", items:[
   {id:"sh1", descr:"Thick chocolate shake, blended cold and frothy.", name:"Chocolate Shake", price:100},
   {id:"sh2", descr:"Crushed Oreo blended through cold milk.", name:"Oreo Shake", price:120},
   {id:"sh3", descr:"Milky and sweet with KitKat blended in.", name:"KitKat Shake", price:120},
   {id:"sh4", descr:"Sweet and tangy pineapple, blended chilled.", name:"Pineapple Milk Shake", price:120},
   {id:"sh5", descr:"Ripe mango blended thick with cold milk.", name:"Mango Milk Shake", price:140},
   {id:"sh6", descr:"Brownie blended right in — dense and very sweet.", name:"Brownie Shake", price:150},
   {id:"sh7", descr:"Custard apple blended cold, delicate and creamy.", name:"Sitafal Shake", price:150},
   {id:"sh8", descr:"Sweet strawberry, blended pink and chilled.", name:"Strawberry Milk Shake", price:150},
   {id:"sh9", descr:"Fig blended with milk — mildly sweet, nutty.", name:"Anjeer Milk Shake", price:150}
 ]},
 { id:"mojito", name:"Mocktails", items:[
   {id:"mj1", descr:"Sharp green apple with mint and soda, over ice.", name:"Green Apple Mojito", price:100},
   {id:"mj2", descr:"Bright citrus and mint, fizzy and cold.", name:"Blue Curacao Mojito", price:100},
   {id:"mj3", descr:"Sweet mango with lime and mint, served tall.", name:"Mango Mojito", price:100},
   {id:"mj4", descr:"Sweet-tart strawberry, mint and soda over ice.", name:"Strawberry Mojito", price:100}
 ]},
 { id:"pizza", name:"Pizza", note:"Small 8 inch · Medium 10 inch · Large 12 inch", sized:true,
   sizeLabels:["Small","Medium","Large"], items:[
   {id:"pz1", descr:"Just tomato, cheese and herbs. The simple one.", name:"Margherita", prices:[130,150,180]},
   {id:"pz2", descr:"Sweet sliced onion over melted cheese.", name:"Onion Pizza", prices:[140,170,200]},
   {id:"pz3", descr:"Crisp capsicum with cheese — mild and fresh.", name:"Capsicum Pizza", prices:[140,170,200]},
   {id:"pz4", descr:"Fresh tomato and cheese, light and tangy.", name:"Tomato Pizza", prices:[140,170,200]},
   {id:"pz5", descr:"Mixed vegetables with cheese. The everyday choice.", name:"Veg Pizza", prices:[150,180,210]},
   {id:"pz6", descr:"Smoky tandoori masala over mixed vegetables.", name:"Tandoor Veg Pizza", prices:[170,200,230]},
   {id:"pz7", descr:"Mixed vegetables with a proper chilli kick.", name:"Spicy Veg Pizza", prices:[180,200,230]},
   {id:"pz8", descr:"Tangy peri peri seasoning — hot and zesty.", name:"Peri Peri Pizza", prices:[180,210,240]},
   {id:"pz9", descr:"Earthy mushrooms melted into the cheese.", name:"Mushroom Pizza", prices:[190,220,250]},
   {id:"pz10", descr:"Loaded with every vegetable we have.", name:"Veg Overload Pizza", prices:[200,230,250]},
   {id:"pz11", descr:"Sweet corn under a blanket of cheese.", name:"Corn Pizza", prices:[200,230,250]},
   {id:"pz12", descr:"Smoky tandoori paneer — rich and filling.", name:"Tandoor Paneer Pizza", prices:[200,230,250]},
   {id:"pz13", descr:"Extra cheese with sweet corn throughout.", name:"Cheese Corn Pizza", prices:[200,250,300]},
   {id:"pz14", descr:"Cheese in the crust as well as on top.", name:"Cheese Burst Pizza", prices:[200,250,300]},
   {id:"pz15", descr:"Our house combo — the most loaded pizza we make.", name:"0125 My$tic Pizza", qual:"Combo", prices:[400,450,500], tag:"House special"}
 ]},
 { id:"burger", name:"Burger", items:[
   {id:"bg1", descr:"Crumbed veg patty in a soft bun with salad.", name:"Veg Burger", price:70},
   {id:"bg2", descr:"Veg patty with a melted cheese slice.", name:"Veg Cheese Burger", price:80},
   {id:"bg3", descr:"Spiced paneer patty — soft and filling.", name:"Paneer Burger", price:100},
   {id:"bg4", descr:"Tangy peri peri spice right through the patty.", name:"Peri Peri Burger", price:120},
   {id:"bg5", descr:"Paneer patty with a real chilli heat.", name:"Spicy Paneer Burger", price:130},
   {id:"bg6", descr:"Our house combo burger — the biggest one.", name:"0125 My$tic Burger", qual:"Combo", price:150, tag:"House special"}
 ]},
 { id:"fries", name:"Fries", items:[
   {id:"fr1", descr:"Hot, crisp and simply salted.", name:"Salted", price:80},
   {id:"fr2", descr:"Crisp fries tossed in tangy masala.", name:"Masala", price:100},
   {id:"fr3", descr:"Tossed in hot peri peri seasoning.", name:"Peri Peri", price:120},
   {id:"fr4", descr:"Coated in spicy Schejwan sauce.", name:"Schejwan", price:140},
   {id:"fr5", descr:"Hot fries under melted cheese.", name:"Cheese", price:150}
 ]},
 { id:"sandwich", name:"Sandwiches", items:[
   {id:"sw1", descr:"Grilled crisp, filled with fresh vegetables.", name:"Veg Grill", price:70},
   {id:"sw2", descr:"Vegetables and melted cheese, grilled crisp.", name:"Veg Cheese", price:80},
   {id:"sw3", descr:"Creamy sweet corn filling, grilled hot.", name:"Corn Sandwich", price:90},
   {id:"sw4", descr:"Spiced paneer with cheese, grilled through.", name:"Paneer Cheese", price:100},
   {id:"sw5", descr:"Warm chocolate filling — sweet and gooey.", name:"Chocolate", price:100},
   {id:"sw6", descr:"Creamy vegetable filling, mild and soft.", name:"Rich Creamy", price:120},
   {id:"sw7", descr:"Garlic butter and cheese, grilled golden.", name:"Garlic Cheese", price:120}
 ]},
 { id:"baked", name:"Baked Sandwiches", items:[
   {id:"bs1", descr:"Paneer baked under bubbling cheese.", name:"Indian Cottage Cheese", price:150},
   {id:"bs2", descr:"Spiced potato baked with cheese on top.", name:"Potato-Cheese", price:170},
   {id:"bs3", descr:"Tangy, spicy paneer baked till golden.", name:"Chatpata Paneer", price:180},
   {id:"bs4", descr:"Smoky tandoori filling, baked hot.", name:"Tandoor Special", price:190},
   {id:"bs5", descr:"Loaded and baked — our richest sandwich.", name:"New York Special", price:200}
 ]},
 { id:"pasta", name:"Pasta", items:[
   {id:"ps1", descr:"Creamy white sauce — mild and comforting.", name:"White Sauce Pasta", price:130},
   {id:"ps2", descr:"Tangy tomato sauce with herbs.", name:"Red Sauce Pasta", price:140},
   {id:"ps3", descr:"Extra cheesy and rich, served hot.", name:"Cheese Pasta", price:150}
 ]},
 { id:"twister", name:"Twister", items:[
   {id:"tw1", descr:"Spiral-cut potato, fried crisp on a stick.", name:"Regular", price:60},
   {id:"tw2", descr:"Crisp spiral potato dusted with tangy masala.", name:"Masala", price:70},
   {id:"tw3", descr:"Crisp spiral potato with our own spice mix.", name:"Magic Masala", price:80},
   {id:"tw4", descr:"Smoky tandoori seasoning on crisp potato.", name:"Tandoor", price:90},
   {id:"tw5", descr:"Hot peri peri dust on a crisp spiral.", name:"Peri Peri", price:100},
   {id:"tw6", descr:"Crisp spiral potato with melted cheese.", name:"Cheese", price:120}
 ]},
 { id:"maggie", name:"Maggie", items:[
   {id:"mg1", descr:"The classic, served hot in a bowl.", name:"Regular Maggie", price:50},
   {id:"mg2", descr:"Noodles cooked through with mixed vegetables.", name:"Veg Maggie", price:60},
   {id:"mg3", descr:"Smoky tandoori masala stirred through.", name:"Tandoor Maggie", price:70},
   {id:"mg4", descr:"Sweet corn through soft hot noodles.", name:"Corn Maggie", price:80},
   {id:"mg5", descr:"Soft paneer cubes in hot noodles.", name:"Paneer Maggie", price:90},
   {id:"mg6", descr:"Paneer and melted cheese — rich and filling.", name:"Paneer Cheese", price:100}
 ]},
 { id:"momo", name:"Momo", items:[
   {id:"mo1", descr:"Steamed dumplings, served with spicy red chutney.", name:"Veg Momo", price:100},
   {id:"mo2", descr:"Paneer-filled steamed momos with chutney.", name:"Paneer Momo", price:120}
 ]},
 { id:"manchurian", name:"Manchurian", items:[
   {id:"mn1", descr:"Fried veg balls in tangy Indo-Chinese gravy.", name:"Veg Manchurian", qual:"10 pc", price:80},
   {id:"mn2", descr:"The same balls, tossed dry and spicy.", name:"Dry Manchurian", qual:"10 pc", price:80}
 ]},
 { id:"paneer", name:"Paneer", items:[
   {id:"pn1", descr:"Paneer in tangy Indo-Chinese gravy.", name:"Paneer Manchurian", qual:"10 pc", price:100},
   {id:"pn2", descr:"Fried paneer, spicy and curry-leaf hot.", name:"Paneer 65", qual:"10 pc", price:120},
   {id:"pn3", descr:"Paneer tossed with capsicum and green chilli.", name:"Paneer Chilli", qual:"10 pc", price:130},
   {id:"pn4", descr:"Sweet, hot and sticky dragon sauce.", name:"Paneer Dragon", qual:"10 pc", price:150}
 ]},
 { id:"rice", name:"Rice", items:[
   {id:"rc1", descr:"Wok-tossed rice with vegetables. Mild.", name:"Fried Rice", price:70},
   {id:"rc2", descr:"Spicy Schejwan sauce right through the rice.", name:"Schejwan Rice", price:80},
   {id:"rc3", descr:"Fried rice served with manchurian gravy.", name:"Manchurian Rice", price:90},
   {id:"rc4", descr:"Manchurian and Schejwan together — properly hot.", name:"Manchurian Schejwan", price:100},
   {id:"rc5", descr:"Spicy Schejwan rice with soft paneer.", name:"Paneer Schejwan", price:110},
   {id:"rc6", descr:"Rice, noodles and gravy on one plate.", name:"Tripple Rice", price:120},
   {id:"rc7", descr:"Fried rice tossed with mushrooms.", name:"Mushroom Rice", price:140}
 ]},
 { id:"noodles", name:"Noodles", items:[
   {id:"nd1", descr:"Wok-tossed noodles — mild and savoury.", name:"Hakka Noodles", price:70},
   {id:"nd2", descr:"Noodles tossed with mixed vegetables.", name:"Veg Noodles", price:80},
   {id:"nd3", descr:"Hot Schejwan sauce through the noodles.", name:"Schejwan Noodles", price:90},
   {id:"nd4", descr:"Noodles served with manchurian on top.", name:"Manchurian Noodles", price:100},
   {id:"nd5", descr:"Soft paneer tossed through the noodles.", name:"Paneer Noodles", price:120},
   {id:"nd6", descr:"Paneer with spicy Schejwan noodles.", name:"Paneer Schejwan Noodles", price:140}
 ]},
 { id:"soup", name:"Soup", items:[
   {id:"sp1", descr:"Hot and spicy, topped with crisp fried noodles.", name:"Manchow Soup", price:70},
   {id:"sp2", descr:"Light clear broth with vegetables.", name:"Vegetable Soup", price:80},
   {id:"sp3", descr:"Thick, mildly sweet and comforting.", name:"Sweetcorn Soup", price:90},
   {id:"sp4", descr:"Creamy and earthy, served hot.", name:"Mushroom Soup", price:100}
 ]},
 { id:"dessert", name:"Dessert", items:[
   {id:"ds1", descr:"Classic vanilla, served cold in a cup.", name:"Vanilla", price:70},
   {id:"ds2", descr:"Rich chocolate ice-cream.", name:"Chocolate", price:80},
   {id:"ds3", descr:"Sweet butterscotch with a crunch through it.", name:"Butterscotch", price:90},
   {id:"ds4", descr:"Apricot and dry fruit — rich and nutty.", name:"Dry-Fruit Apricot", price:150},
   {id:"ds5", descr:"Our house special — the richest thing we make.", name:"0125 My$tic Special", price:200, tag:"House special"}
 ]}
];
