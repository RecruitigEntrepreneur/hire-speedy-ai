export const scrollToSection = (sectionId: string) => {
  const element = document.getElementById(sectionId);
  if (element) {
    const offset = 80; // Header height
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;
    
    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }
};

export const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
  if (href.startsWith('/#')) {
    e.preventDefault();
    const sectionId = href.replace('/#', '');
    scrollToSection(sectionId);
  }
};
