export default function Button({ children, variant = 'primary', as: Component = 'button', className = '', ...props }) {
  return (
    <Component className={`button button-${variant} ${className}`.trim()} {...props}>
      {children}
    </Component>
  );
}
