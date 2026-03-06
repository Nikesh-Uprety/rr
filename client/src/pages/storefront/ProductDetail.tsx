import { useState } from "react";
import { useRoute } from "wouter";
import { MOCK_PRODUCTS } from "@/lib/mockData";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Minus, Plus, ShoppingBag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ProductDetail() {
  const [, params] = useRoute("/product/:id");
  const { toast } = useToast();
  const product = MOCK_PRODUCTS.find(p => p.id === params?.id);
  const addItem = useCartStore(state => state.addItem);
  
  const [selectedVariant, setSelectedVariant] = useState(product?.variants[0]);
  const [quantity, setQuantity] = useState(1);

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-serif mb-4">Product not found</h2>
        <Button asChild>
          <Link href="/products">Back to Collection</Link>
        </Button>
      </div>
    );
  }

  // Get unique colors and sizes
  const colors = Array.from(new Set(product.variants.map(v => v.color)));
  const sizes = Array.from(new Set(product.variants.map(v => v.size)));

  const handleAddToCart = () => {
    if (selectedVariant) {
      addItem(product, selectedVariant, quantity);
      toast({
        title: "Added to cart",
        description: `${quantity}x ${product.name} (${selectedVariant.color}, ${selectedVariant.size})`,
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/products" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Collection
      </Link>

      <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
        {/* Images */}
        <div className="w-full lg:w-1/2 flex flex-col gap-4">
          <div className="aspect-[3/4] bg-muted rounded-xl overflow-hidden relative">
            <img 
              src={product.images[0]} 
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Details */}
        <div className="w-full lg:w-1/2 flex flex-col pt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm tracking-widest uppercase text-muted-foreground">{product.category}</span>
            <span className="text-sm text-muted-foreground">{product.sku}</span>
          </div>
          <h1 className="text-4xl font-serif font-medium tracking-tight mb-4">{product.name}</h1>
          <p className="text-2xl mb-8">${product.price.toFixed(2)}</p>

          <p className="text-muted-foreground leading-relaxed mb-8">
            {product.description || "Minimalist design crafted with premium materials for everyday wear. This piece combines comfort with an elevated aesthetic."}
          </p>

          {/* Color Selection */}
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-3">Color: <span className="text-muted-foreground font-normal">{selectedVariant?.color}</span></h3>
            <div className="flex gap-2">
              {colors.map(color => (
                <button
                  key={color}
                  onClick={() => {
                    const variant = product.variants.find(v => v.color === color && v.size === selectedVariant?.size) 
                      || product.variants.find(v => v.color === color);
                    if (variant) setSelectedVariant(variant);
                  }}
                  className={`px-4 py-2 border rounded-md text-sm transition-all ${
                    selectedVariant?.color === color 
                      ? "border-primary bg-primary/5 font-medium" 
                      : "border-border hover:border-primary/50 text-muted-foreground"
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          {/* Size Selection */}
          <div className="mb-8">
            <div className="flex justify-between items-end mb-3">
              <h3 className="text-sm font-medium">Size</h3>
              <button className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Size Guide</button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {sizes.map(size => {
                // Check if this size is available in the selected color
                const isAvailable = product.variants.some(v => v.color === selectedVariant?.color && v.size === size);
                
                return (
                  <button
                    key={size}
                    disabled={!isAvailable}
                    onClick={() => {
                      const variant = product.variants.find(v => v.color === selectedVariant?.color && v.size === size);
                      if (variant) setSelectedVariant(variant);
                    }}
                    className={`py-3 border rounded-md text-sm transition-all text-center ${
                      selectedVariant?.size === size 
                        ? "border-primary bg-primary text-primary-foreground font-medium" 
                        : !isAvailable 
                          ? "border-border/50 text-muted-foreground/30 bg-muted/30 cursor-not-allowed line-through" 
                          : "border-border hover:border-primary/50 text-foreground"
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-4 mb-8">
            <div className="flex items-center border border-border rounded-md">
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-12 h-12 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                disabled={quantity <= 1}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center text-sm font-medium">{quantity}</span>
              <button 
                onClick={() => setQuantity(quantity + 1)}
                className="w-12 h-12 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                disabled={quantity >= product.stock}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <Button 
              className="flex-1 h-12 rounded-md" 
              onClick={handleAddToCart}
              disabled={!selectedVariant || product.stock === 0}
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
            </Button>
          </div>

          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${product.stock > 0 ? "bg-green-500" : "bg-red-500"}`} />
            {product.stock > 10 ? "In Stock" : product.stock > 0 ? `Low Stock (${product.stock} left)` : "Out of Stock"}
          </div>
          
          <div className="mt-12 pt-8 border-t border-border space-y-6">
            <div>
              <h4 className="font-medium mb-2">Details</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside pl-4">
                <li>Premium construction and materials</li>
                <li>Designed for a relaxed, comfortable fit</li>
                <li>Imported</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Shipping & Returns</h4>
              <p className="text-sm text-muted-foreground">Free standard shipping on orders over $150. Returns accepted within 30 days of purchase.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}